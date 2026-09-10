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
from urllib.parse import urlparse

from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/app/config.py -> backend/ -> data/
_DEFAULT_DATA_DIR = Path(__file__).resolve().parents[1] / "data"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    resend_api_key: str = ""
    resend_audience_id: str = ""
    notify_email: str = ""
    site_url: str = "http://localhost:5173"

    # Not in the checklist's env table (which only lists what launch needs
    # decided elsewhere) — this one has a sane computed default, so it's
    # opt-in to override rather than a required addition.
    from_email: str = ""

    sold_state_path: Path = _DEFAULT_DATA_DIR / "sold_state.json"
    subscribers_path: Path = _DEFAULT_DATA_DIR / "subscribers.json"

    @property
    def sender_address(self) -> str:
        """Falls back to noreply@<site_url's host> when FROM_EMAIL isn't
        set. Still has to be a domain verified in Resend either way — this
        just saves typing the same domain twice in the common case."""
        if self.from_email:
            return self.from_email
        host = urlparse(self.site_url).hostname or "example.com"
        return f"noreply@{host}"


@lru_cache
def get_settings() -> Settings:
    return Settings()
