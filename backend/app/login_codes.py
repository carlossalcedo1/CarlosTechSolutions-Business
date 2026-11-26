"""One-time sign-in codes for the admin panel.

Same shape as sold_store.py and for the same reason: JSON on the data
volume, one lock, write-then-rename. This is a single-container deploy with
one writer, and at most five admins holding at most one live code each, so
a database here would be a dependency and a migration story bought with
nothing. sold_store.py's docstring names the trigger to move to SQLite —
concurrent writers or multiple replicas — and this is further from it than
anything else in the app.

The codes are 8 digits. That's 100 million values, which sounds ample and
isn't on its own: the whole space is sweepable if an attacker gets
unlimited, instant guesses. Three things make it safe, and all three have
to stay:

- one live code per username, deleted the moment it's used
- ten-minute expiry
- five wrong guesses and the code is destroyed, not just rejected

The per-IP rate limit on the verify route is a fourth, outside this file.

Codes are stored as PBKDF2 hashes rather than plaintext. Against an
attacker who can read this file that is a speed bump and not a vault — 10^8
candidates is small — but it costs one line, and the file would otherwise
be a list of live credentials sitting next to the sold-state data in a
backup. The expiry is what actually bounds the damage.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import secrets
import threading
import time
from pathlib import Path

CODE_LENGTH = 8
CODE_TTL_SECONDS = 10 * 60
MAX_ATTEMPTS = 5

# ~100ms per check on the NUC. Deliberate: it makes an offline sweep of the
# 8-digit space cost real time, and a login is a once-a-session action where
# nobody notices a tenth of a second. The verify route's rate limit is what
# stops this being a CPU-burn lever.
_PBKDF2_ROUNDS = 120_000
_SALT_BYTES = 16


def normalize_username(username: str) -> str:
    """Lowercase and trimmed, matching Settings.admin_allowlist's keys.

    One function so the allowlist lookup and the code store can't ever
    disagree about whether "CMSal06 " is the same person as "cmsal06".
    """
    return username.strip().lower()


def generate_code() -> str:
    """A uniformly random 8-digit code, leading zeros included.

    randbelow, not randint on a shuffled alphabet or anything cleverer —
    this is the one place where a predictable value is the whole ballgame.
    Formatting with a zero pad keeps every code the same length, so a code
    starting 0 doesn't arrive looking like a 7-digit one.
    """
    return f"{secrets.randbelow(10 ** CODE_LENGTH):0{CODE_LENGTH}d}"


def _hash(code: str, salt: bytes) -> str:
    return hashlib.pbkdf2_hmac("sha256", code.encode(), salt, _PBKDF2_ROUNDS).hex()


class LoginCodeStore:
    def __init__(self, path: Path):
        self._path = path
        self._lock = threading.Lock()
        self._path.parent.mkdir(parents=True, exist_ok=True)
        if not self._path.exists():
            self._write({"codes": {}})

    def _read(self) -> dict:
        return json.loads(self._path.read_text())

    def _write(self, data: dict) -> None:
        # Write-then-rename, same as sold_store.py: a crash mid-write can't
        # leave an unparseable file that locks everyone out.
        tmp = self._path.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, indent=2) + "\n")
        tmp.replace(self._path)

    @staticmethod
    def _drop_expired(codes: dict, now: float) -> None:
        for username in [u for u, c in codes.items() if c["expires_at"] <= now]:
            del codes[username]

    def issue(self, username: str) -> str:
        """Create a code for `username` and return it in the clear, once.

        Any code that username already had is replaced, so asking for a
        second code invalidates the first — otherwise every request would
        leave another live credential lying around for its full ten minutes.
        """
        username = normalize_username(username)
        code = generate_code()
        salt = secrets.token_bytes(_SALT_BYTES)
        now = time.time()

        with self._lock:
            data = self._read()
            codes = data.setdefault("codes", {})
            self._drop_expired(codes, now)
            codes[username] = {
                "salt": salt.hex(),
                "hash": _hash(code, salt),
                "expires_at": now + CODE_TTL_SECONDS,
                "attempts": 0,
            }
            self._write(data)

        return code

    def verify(self, username: str, code: str) -> bool:
        """True exactly once, for the right live code.

        Consumed on success. On failure the attempt is counted and written
        back before returning — a counter that only persists on the happy
        path would make brute forcing free.
        """
        username = normalize_username(username)
        now = time.time()

        with self._lock:
            data = self._read()
            codes = data.setdefault("codes", {})
            self._drop_expired(codes, now)

            record = codes.get(username)
            if record is None:
                # Covers "never asked for a code", "already used it" and
                # "it expired" with one answer, because the caller must not
                # be able to tell those apart.
                self._write(data)
                return False

            record["attempts"] += 1
            if record["attempts"] > MAX_ATTEMPTS:
                del codes[username]
                self._write(data)
                return False

            expected = record["hash"]
            actual = _hash(code, bytes.fromhex(record["salt"]))
            # compare_digest, not ==: these are hex digests of a secret, and
            # an early-exit comparison leaks how much of one was right.
            if hmac.compare_digest(expected, actual):
                del codes[username]
                self._write(data)
                return True

            self._write(data)
            return False

    def has_live_code(self, username: str) -> bool:
        """Only for tests and diagnostics — never a reason to branch in a
        route, which should always go through verify()."""
        username = normalize_username(username)
        with self._lock:
            codes = self._read().get("codes", {})
            record = codes.get(username)
            return record is not None and record["expires_at"] > time.time()
