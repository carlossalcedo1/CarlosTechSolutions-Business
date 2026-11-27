"""Server configuration, loaded from the environment.

See LAUNCH_CHECKLIST.md's "Environment variables" table for what each of
these is and where it comes from. Every field here is server-side only —
nothing in this file is ever handed to the browser.

Everything defaults to blank/harmless so the app can boot and iterate
locally before Stripe/Resend keys exist. Routes that actually need a key
check for it and fail loudly (500, with a clear message) rather than the
whole container refusing to start.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import ClassVar
from urllib.parse import urlparse

from pydantic_settings import BaseSettings, SettingsConfigDict

from .catalog import CATALOG_PATH
from .inventory import DEPLOY_SCRIPT, PUBLIC_ITEMS_DIR, SOLD_ITEMS_PATH

# backend/app/config.py -> backend/ -> data/
_DEFAULT_DATA_DIR = Path(__file__).resolve().parents[1] / "data"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    resend_api_key: str = ""
    resend_audience_id: str = ""
    # General form notifications (contact, trade-in).
    notify_email: str = ""
    # "Cha-ching" sold alerts, kept separate on purpose — see main.py's
    # webhook handler — so a sale notice doesn't sit in the same inbox as
    # customer contact/trade-in mail. Falls back to notify_email if unset
    # rather than requiring both to be configured.
    sale_notify_email: str = ""
    site_url: str = "http://localhost:5173"

    # Not in the checklist's env table (which only lists what launch needs
    # decided elsewhere) — this one has a sane computed default, so it's
    # opt-in to override rather than a required addition.
    from_email: str = ""

    # Pushover — push alerts to your own phone (app/notifier.py). Operator
    # only: these two values are *your* account, so this is never a channel
    # for customers. Both blank means no pushes, the same way a missing
    # Resend key means no email.
    #   PUSHOVER_TOKEN     pushover.net -> Create an Application
    #   PUSHOVER_USER_KEY  shown on the pushover.net dashboard when logged in
    pushover_token: str = ""
    pushover_user_key: str = ""

    # Admin sign-in allowlist. Comma-separated, and the only thing that
    # decides who may ask for a login code.
    #
    #   ADMIN_USERNAMES=cmsal06
    #   ADMIN_USERNAMES=cmsal06,sam:uQiZabc123...
    #
    # A bare name gets its code at PUSHOVER_USER_KEY — the owner's device.
    # A `name:key` pair sends to that key instead, which is what a second
    # admin needs: Pushover addresses a device, not a username this app
    # invented, so there is no way to push to someone without their own key.
    #
    # Blank means nobody can sign in, which is the right default for a
    # setting that hands out access.
    admin_usernames: str = ""

    # The shop's own timezone, used to format the sale time in the push
    # (app/emails.py). Not cosmetic: containers run on UTC unless told
    # otherwise, so without this a 12:30pm sale alerts as 17:30. Any IANA
    # name works; an unrecognised one falls back to UTC and logs.
    timezone: str = "America/New_York"

    sold_state_path: Path = _DEFAULT_DATA_DIR / "sold_state.json"
    subscribers_path: Path = _DEFAULT_DATA_DIR / "subscribers.json"
    # Code-only listings (app/codes.py) — same volume, so codes survive a
    # redeploy and gen_code.py can write them without one.
    codes_path: Path = _DEFAULT_DATA_DIR / "codes.json"
    # Live admin sign-in codes (app/login_codes.py). Same volume so a
    # redeploy mid-login doesn't strand someone holding a valid code.
    login_codes_path: Path = _DEFAULT_DATA_DIR / "login_codes.json"
    # Enrolled passkeys (app/passkeys.py). Public keys and opaque ids —
    # nothing secret, but losing it means re-enrolling every device.
    passkeys_path: Path = _DEFAULT_DATA_DIR / "passkeys.json"
    # Live admin sessions (app/sessions.py). Deleting this file signs
    # everyone out, which is the blunt version of revoke_all.
    sessions_path: Path = _DEFAULT_DATA_DIR / "sessions.json"
    # Paid orders and their shipping state (app/orders.py), written by the
    # Stripe webhook.
    orders_path: Path = _DEFAULT_DATA_DIR / "orders.json"
    # Photos for codes made in the admin panel (app/admin_codes.py). On the
    # data volume beside codes.json, which is what lets the panel make a
    # code with photos on the live server without a deploy.
    code_photos_dir: Path = _DEFAULT_DATA_DIR / "code_photos"

    # Where the admin panel's inventory editing reads and writes. These
    # default to the repo's own files — the same ones scripts/add_item.py
    # and scripts/sold_item.py use — and exist as settings mainly so tests
    # can point every write at a temp directory instead of real inventory.
    catalog_path: Path = CATALOG_PATH
    public_items_dir: Path = PUBLIC_ITEMS_DIR
    sold_items_path: Path = SOLD_ITEMS_PATH
    deploy_script: Path = DEPLOY_SCRIPT
    # What the panel's Deploy button last did, and its output. Runtime
    # state on the data volume, same as everything else in there.
    deploy_state_path: Path = _DEFAULT_DATA_DIR / "deploy_state.json"
    deploy_log_path: Path = _DEFAULT_DATA_DIR / "deploy.log"

    @property
    def sender_address(self) -> str:
        """Falls back to noreply@<site_url's host> when FROM_EMAIL isn't
        set. Still has to be a domain verified in Resend either way — this
        just saves typing the same domain twice in the common case."""
        if self.from_email:
            return self.from_email
        host = urlparse(self.site_url).hostname or "example.com"
        return f"noreply@{host}"

    @property
    def sale_notify_address(self) -> str:
        return self.sale_notify_email or self.notify_email

    # Small on purpose. This is a personal admin panel, and a cap means a
    # fat-fingered env var can't quietly widen access to a list nobody reads.
    # ClassVar, or pydantic-settings treats it as another env-backed
    # field and refuses to build the model at import time.
    MAX_ADMINS: ClassVar[int] = 5

    @property
    def admin_allowlist(self) -> dict[str, str]:
        """username -> the Pushover user key its code goes to.

        Raises on a malformed value rather than silently dropping entries:
        a typo'd allowlist that locks you out is recoverable, one that
        quietly admits the wrong person is not. It raises here rather than
        at import time so a bad value fails the login route with a clear
        500 instead of stopping the container from booting at all — same
        pattern as the Stripe keys.
        """
        allowlist: dict[str, str] = {}
        for entry in self.admin_usernames.split(","):
            entry = entry.strip()
            if not entry:
                continue
            name, _, key = entry.partition(":")
            name = name.strip().lower()
            key = key.strip() or self.pushover_user_key
            if not name:
                raise ValueError(f"ADMIN_USERNAMES entry has no username: {entry!r}")
            if name in allowlist:
                raise ValueError(f"ADMIN_USERNAMES lists {name!r} twice")
            allowlist[name] = key

        if len(allowlist) > self.MAX_ADMINS:
            raise ValueError(
                f"ADMIN_USERNAMES has {len(allowlist)} entries; the maximum is "
                f"{self.MAX_ADMINS}"
            )
        return allowlist

    @property
    def cookies_require_https(self) -> bool:
        """Whether to set the Secure flag on the session cookie.

        Driven by SITE_URL rather than hardcoded: Secure cookies are simply
        not sent over http, so hardcoding True would make sign-in silently
        impossible against the local dev server, and hardcoding False would
        ship a session cookie that leaks over any plain-http request in
        production.
        """
        return self.site_url.startswith("https://")

    @property
    def pushover_configured(self) -> bool:
        """Both halves or nothing — a token with no user key (or the other
        way round) can't send, so treat a half-filled pair as "off" rather
        than letting notifier.py log a warning on every sale."""
        return bool(self.pushover_token and self.pushover_user_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
