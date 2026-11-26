"""Registered passkeys, per admin.

Same JSON-on-the-volume shape as login_codes.py and sold_store.py. A handful
of admins with a couple of devices each is nowhere near wanting a database.

Nothing enrols a passkey yet — that's a button in the admin panel's settings,
and the panel doesn't exist. So this store is empty in practice and
`has_credential` answers False for everyone, which is exactly what the
sign-in page needs to show "Not enrolled." The shape of a record is settled
here anyway, because the sign-in path has to be written against something.

What's stored is what WebAuthn verification needs later: the credential id
the authenticator hands back, its public key, and the signature counter.
None of it is secret — a public key is public, and the id is an opaque
handle — so unlike login_codes.py there's nothing here to hash. Losing this
file means re-enrolling devices, not a breach.

One thing worth knowing before enrolment gets built: a passkey is bound to
the origin it was created on. Credentials enrolled on
carlostechsolutions.com will not work on nexfixtech.com, so enrolment should
wait for the domain move (issue #3) or every device will need doing twice.
"""

from __future__ import annotations

import json
import threading
import time
from pathlib import Path

from .login_codes import normalize_username


class PasskeyStore:
    def __init__(self, path: Path):
        self._path = path
        self._lock = threading.Lock()
        self._path.parent.mkdir(parents=True, exist_ok=True)
        if not self._path.exists():
            self._write({"credentials": {}})

    def _read(self) -> dict:
        return json.loads(self._path.read_text())

    def _write(self, data: dict) -> None:
        # Write-then-rename, as everywhere else in here: a half-written file
        # would lock an admin out of their own panel.
        tmp = self._path.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, indent=2) + "\n")
        tmp.replace(self._path)

    def has_credential(self, username: str) -> bool:
        """Whether this admin has at least one passkey on file.

        The only question the sign-in page asks today, and the thing that
        decides between starting a WebAuthn ceremony and saying
        "Not enrolled."
        """
        return bool(self.list_credentials(username))

    def list_credentials(self, username: str) -> list[dict]:
        username = normalize_username(username)
        with self._lock:
            return list(self._read().get("credentials", {}).get(username, []))

    def add_credential(
        self,
        username: str,
        *,
        credential_id: str,
        public_key: str,
        label: str = "",
    ) -> None:
        """Enrol a device. Nothing calls this yet — the admin panel's settings
        screen will, once there's an admin panel."""
        username = normalize_username(username)
        with self._lock:
            data = self._read()
            creds = data.setdefault("credentials", {}).setdefault(username, [])
            if any(c["credential_id"] == credential_id for c in creds):
                # Re-enrolling the same authenticator replaces rather than
                # duplicates, or the list grows every time someone retries.
                creds[:] = [c for c in creds if c["credential_id"] != credential_id]
            creds.append(
                {
                    "credential_id": credential_id,
                    "public_key": public_key,
                    "label": label,
                    "sign_count": 0,
                    "created_at": time.time(),
                }
            )
            self._write(data)

    def remove_credential(self, username: str, credential_id: str) -> bool:
        """Drop one device. Returns whether anything was removed.

        Needed from the start even though enrolment isn't built: a passkey
        you can enrol but not revoke is worse than no passkey, because a
        stolen laptop would be permanent.
        """
        username = normalize_username(username)
        with self._lock:
            data = self._read()
            creds = data.get("credentials", {}).get(username, [])
            remaining = [c for c in creds if c["credential_id"] != credential_id]
            if len(remaining) == len(creds):
                return False
            data["credentials"][username] = remaining
            self._write(data)
            return True
