"""Sending transactional email via Resend.

Kept to one function so every call site goes through the same place — easy
to swap providers later, or to no-op in tests without touching main.py.

Named `mailer` and not `email` on purpose: `email` is a stdlib package, and
shadowing it inside `app/` invites a confusing import bug the first time
anything in here (or a dependency) does `import email`.
"""

from __future__ import annotations

import html as html_lib
import logging
import re

import resend

from .config import Settings

logger = logging.getLogger("app.mailer")

_TAG_RE = re.compile(r"<[^>]+>")


def _html_to_text(source: str) -> str:
    """Crude plain-text fallback, good enough for the plain <p>...</p> bodies
    built in main.py — not a general HTML-to-text converter. A missing text
    part is a real (if small) spam-score signal, which is the only reason
    this exists; hand-authored, prettier templates are a stretch goal."""
    text = source.replace("</p>", "\n\n").replace("<br>", "\n").replace("<br/>", "\n")
    return html_lib.unescape(_TAG_RE.sub("", text)).strip()


def send_email(
    settings: Settings,
    *,
    to: str,
    subject: str,
    html: str | None = None,
    text: str | None = None,
    reply_to: str | None = None,
) -> None:
    # Either or both: HTML with an auto-derived text part (the form
    # notifications), or text only (the admin "Sold" alert — see emails.py).
    if html is None and text is None:
        raise ValueError("send_email needs html, text, or both")

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
        "text": text if text is not None else _html_to_text(html),
    }
    if html is not None:
        payload["html"] = html
    if reply_to:
        payload["reply_to"] = reply_to
    resend.Emails.send(payload)
