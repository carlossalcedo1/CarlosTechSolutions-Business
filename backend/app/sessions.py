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

Expiry is a flat three days from sign-in. Not sliding: a session that
renews itself on use would never expire for anyone actually using it,
which is the opposite of "sign in again after three days". The cost is
that it can run out mid-task on day three — that's the deliberate trade,
and it's why the window is short enough to be predictable rather than a
surprise once a month.
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

# How long a sign-in lasts, measured from the moment the code was accepted.
# Using the session does not extend it.
SESSION_DAYS = 3

_SESSION_SECONDS = SESSION_DAYS * 24 * 60 * 60


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
                "expires_at": now + _SESSION_SECONDS,
            }
            self._write(data)

        return token

    def lookup(self, token: str | None) -> str | None:
        """The username this token belongs to, or None.

        Read-only with respect to the deadline: using a session does not
        extend it. That also means the common case — a signed-in admin
        loading a page — never writes to disk at all.
        """
        if not token:
            return None
        now = time.time()
        key = _hash(token)

        with self._lock:
            data = self._read()
            sessions = data.setdefault("sessions", {})
            before = len(sessions)
            self._drop_expired(sessions, now)

            record = sessions.get(key)
            # Only write when something was actually swept, so a normal
            # signed-in request is a pure read.
            if len(sessions) != before:
                self._write(data)

            # None covers expired, revoked and never-existed alike.
            return record["username"] if record else None

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
