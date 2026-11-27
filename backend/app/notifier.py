"""Push notifications to your phone via Pushover.

The counterpart to mailer.py, same shape for the same reason: one function,
so every call site goes through one place and swapping providers (or
no-op'ing in tests) touches nothing else.

Pushover is operator-only and always will be. A recipient needs the Pushover
app installed, their own one-time license, and to hand over their user key —
so this can never be a customer channel. Buyer order confirmations stay
email (mailer.py); this is the "go look at your inbox" nudge.

Deliberately stdlib-only: one form-encoded POST is not worth another line in
requirements.txt, and urllib does it in about as much code as requests would.
"""

from __future__ import annotations

import logging
import urllib.error
import urllib.parse
import urllib.request

from .config import Settings

logger = logging.getLogger("app.notifier")

_API_URL = "https://api.pushover.net/1/messages.json"
_TIMEOUT_SECONDS = 10

# Pushover truncates past these itself; doing it here means the part that
# survives is the part this app chose to keep.
_TITLE_LIMIT = 250
_MESSAGE_LIMIT = 1024


def send_push(
    settings: Settings,
    *,
    title: str,
    message: str,
    url: str | None = None,
    url_title: str | None = None,
    priority: int = 0,
    html: bool = False,
) -> None:
    """Send one push. Logs and returns on failure instead of raising.

    Swallowing errors is deliberate, and the opposite of what mailer.py does.
    The only call site is inside the Stripe webhook, where the email is the
    real notification and this is a convenience on top. Letting a Pushover
    outage raise would hand Stripe a 500, and Stripe would retry a handler
    that has already recorded the sale and sent both emails.

    `priority` 1 is high (bypasses the phone's quiet hours). 2 is emergency
    (retries until acknowledged) and additionally requires `retry` and
    `expire` fields, which this does not send yet — passing 2 today would
    just get the request rejected.

    `html` turns on Pushover's small HTML subset (<b>, <i>, <u>, <font
    color>, <a href>) for the message. It exists because Pushover allows
    exactly one `url` field, so a second link has to be an anchor inside the
    message. Off by default: with it on, a bare & or < in plain text would
    be parsed as markup, so only a caller that escapes its interpolations
    should ask for it. The title is never HTML either way.
    """
    try:
        send_push_strict(
            settings,
            title=title,
            message=message,
            url=url,
            url_title=url_title,
            priority=priority,
            html=html,
        )
    except PushNotConfigured:
        # Mirrors mailer.py's missing-key behaviour: let the app run and be
        # tested before the Pushover keys exist instead of crashing.
        logger.warning("Pushover not configured — not pushing %r", title)
    except PushFailed as exc:
        logger.error("Pushover failed for %r: %s", title, exc)
    except Exception:
        logger.exception("Pushover request failed for %r", title)


class PushError(Exception):
    """Base for the two ways send_push_strict can refuse to have sent."""


class PushNotConfigured(PushError):
    """No token/user key — nothing was attempted."""


class PushFailed(PushError):
    """Pushover was asked and didn't accept it."""


def send_push_strict(
    settings: Settings,
    *,
    title: str,
    message: str,
    url: str | None = None,
    url_title: str | None = None,
    priority: int = 0,
    user_key: str | None = None,
    html: bool = False,
) -> None:
    """Send one push, raising if it didn't go.

    The counterpart to send_push above, which swallows everything. That's
    right where it's used — inside the Stripe webhook, where raising would
    hand Stripe a 500 and earn a retry of a sale already recorded — and
    exactly wrong for an admin login code, where a swallowed failure means
    telling someone to check a phone that will never buzz. Callers that
    need to know pick this one; callers that genuinely don't care keep the
    quiet one.

    `user_key` overrides the configured one, because the admin allowlist
    can carry a second admin's own key (see Settings.admin_allowlist) and
    Pushover addresses a device, not a username.
    """
    user = user_key or settings.pushover_user_key
    if not (settings.pushover_token and user):
        raise PushNotConfigured("Pushover token or user key is not set")

    fields = {
        "token": settings.pushover_token,
        "user": user,
        "title": title[:_TITLE_LIMIT],
        "message": message[:_MESSAGE_LIMIT],
        "priority": str(priority),
    }
    if url:
        fields["url"] = url
    if url_title:
        fields["url_title"] = url_title
    if html:
        fields["html"] = "1"

    request = urllib.request.Request(
        _API_URL,
        data=urllib.parse.urlencode(fields).encode(),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=_TIMEOUT_SECONDS) as response:
            if response.status != 200:
                raise PushFailed(f"Pushover returned HTTP {response.status}")
    except urllib.error.HTTPError as exc:
        # A 4xx here is a bad token or user key, and Pushover's body names
        # the field it rejected — worth surfacing, since the alternative is
        # silently not getting alerts.
        body = exc.read()[:200].decode("utf-8", "replace")
        raise PushFailed(f"HTTP {exc.code} {body}") from exc
    except urllib.error.URLError as exc:
        raise PushFailed(str(exc.reason)) from exc
