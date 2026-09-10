"""Sending transactional email via Resend.

Kept to one function so every call site goes through the same place — easy
to swap providers later, or to no-op in tests without touching main.py.

Named `mailer` and not `email` on purpose: `email` is a stdlib package, and
shadowing it inside `app/` invites a confusing import bug the first time
anything in here (or a dependency) does `import email`.
"""

from __future__ import annotations

import logging

import resend

from .config import Settings

logger = logging.getLogger("app.mailer")


def send_email(
    settings: Settings, *, to: str, subject: str, html: str, reply_to: str | None = None
) -> None:
    if not settings.resend_api_key:
        # Lets the rest of the app run and be tested before the Resend key
        # exists (see LAUNCH_CHECKLIST.md Phase 2) instead of crashing.
        logger.warning("RESEND_API_KEY not set — not sending %r to %s", subject, to)
        return

    resend.api_key = settings.resend_api_key
    payload: dict = {
        "from": settings.sender_address,
        "to": [to],
        "subject": subject,
        "html": html,
    }
    if reply_to:
        payload["reply_to"] = reply_to
    resend.Emails.send(payload)
