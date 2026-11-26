"""Admin sessions: what keeps you signed in after the code is burned.

Opaque tokens, not JWTs. A JWT's one real advantage is that any server can
verify it without a lookup, which matters behind a load balancer and is
worth nothing to a single container reading JSON files. What it costs is
revocation: a signed token is valid until it expires, so a lost laptop
means waiting it out or rotating the secret and kicking everyone. The usual
fix is a server-side blocklist, which is a lookup per request — the exact
thing the JWT was supposed to avoid. So: a random token, a row on disk, and
deleting the row logs that device out instantly.

The token is 32 bytes from secrets.token_urlsafe. Stored as a SHA-256 hash
so a readable sessions.json isn't a pile of live credentials. Plain sha256
is enough here, unlike login_codes.py's PBKDF2 — that was protecting an
8-digit code with only 10^8 possibilities, where an offline sweep is
trivial. 256 bits of entropy has no such problem.

Expiry is sliding with a hard ceiling: each time a session is seen it gets
another IDLE_DAYS, but never past ABSOLUTE_DAYS from when it was created.
Sliding alone means a tab left open stays signed in forever; a fixed expiry
alone means being logged out mid-task on day seven. Both bounds together
are the usual answer.
"""

from __future__ import annotations

import hashlib
import json
import secrets
import threading
import time
from pathlib import Path

from .login_codes import normalize_username

COOKIE_NAME = "nexfix_admin_session"

# Signed out after this long without using it...
IDLE_DAYS = 7
# ...and after this long regardless, however active you've been.
ABSOLUTE_DAYS = 30

_IDLE_SECONDS = IDLE_DAYS * 24 * 60 * 60
_ABSOLUTE_SECONDS = ABSOLUTE_DAYS * 24 * 60 * 60

# Only write the file back when the expiry actually moves by more than this.
# Without it every /api/admin/me would rewrite sessions.json, which on a
# polling frontend is a disk write per request for no gain.
_SLIDE_GRANULARITY_SECONDS = 60 * 60


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


class SessionStore:
    def __init__(self, path: Path):
        self._path = path
        self._lock = threading.Lock()
        self._path.parent.mkdir(parents=True, exist_ok=True)
        if not self._path.exists():
            self._write({"sessions": {}})

    def _read(self) -> dict:
        return json.loads(self._path.read_text())

    def _write(self, data: dict) -> None:
        tmp = self._path.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, indent=2) + "\n")
        tmp.replace(self._path)

    @staticmethod
    def _drop_expired(sessions: dict, now: float) -> None:
        for key in [k for k, s in sessions.items() if s["expires_at"] <= now]:
            del sessions[key]

    def create(self, username: str) -> str:
        """Start a session and return its token in the clear, once."""
        username = normalize_username(username)
        token = secrets.token_urlsafe(32)
        now = time.time()

        with self._lock:
            data = self._read()
            sessions = data.setdefault("sessions", {})
            self._drop_expired(sessions, now)
            sessions[_hash(token)] = {
                "username": username,
                "created_at": now,
                "expires_at": now + _IDLE_SECONDS,
            }
            self._write(data)

        return token

    def lookup(self, token: str | None) -> str | None:
        """The username this token belongs to, or None.

        Slides the expiry forward as a side effect — this is the "you're
        still here" signal, so it's the right place for it.
        """
        if not token:
            return None
        now = time.time()
        key = _hash(token)

        with self._lock:
            data = self._read()
            sessions = data.setdefault("sessions", {})
            self._drop_expired(sessions, now)

            record = sessions.get(key)
            if record is None:
                # Covers expired, revoked and never-existed alike.
                self._write(data)
                return None

            # Slide, but never past the absolute ceiling, and only write if
            # the value meaningfully moved.
            ceiling = record["created_at"] + _ABSOLUTE_SECONDS
            new_expiry = min(now + _IDLE_SECONDS, ceiling)
            if new_expiry - record["expires_at"] > _SLIDE_GRANULARITY_SECONDS:
                record["expires_at"] = new_expiry
                self._write(data)

            return record["username"]

    def revoke(self, token: str | None) -> bool:
        """Sign out this one device. Returns whether anything was removed."""
        if not token:
            return False
        key = _hash(token)
        with self._lock:
            data = self._read()
            sessions = data.setdefault("sessions", {})
            if key not in sessions:
                return False
            del sessions[key]
            self._write(data)
            return True

    def revoke_all(self, username: str) -> int:
        """Sign out every device for this admin. Returns how many went.

        Not reachable from the UI yet, but this is the thing you actually
        want the moment a laptop goes missing, and it's three lines — far
        better here from the start than written in a hurry on a bad day.
        """
        username = normalize_username(username)
        with self._lock:
            data = self._read()
            sessions = data.setdefault("sessions", {})
            doomed = [k for k, s in sessions.items() if s["username"] == username]
            for key in doomed:
                del sessions[key]
            if doomed:
                self._write(data)
            return len(doomed)
