"""The admin sign-in allowlist (Settings.admin_allowlist).

This is the whole access-control decision for the admin panel, so the
parsing gets tested harder than a comma-split would normally deserve. The
cases that matter are the ones where a malformed value could widen access
instead of narrowing it.

_env_file=None throughout, for the reason conftest.py gives: without it
pydantic-settings reads whatever deploy/.env happens to say on this machine,
and these assertions would depend on whose laptop is running them.
"""

from __future__ import annotations

import pytest

from backend.app.config import Settings


def make(admin_usernames: str, user_key: str = "owner-key") -> Settings:
    return Settings(
        _env_file=None,
        admin_usernames=admin_usernames,
        pushover_user_key=user_key,
    )


def test_blank_means_nobody():
    # The default. An empty allowlist has to mean "no one can sign in" and
    # never "anyone can" — this is the test that would catch that inversion.
    assert make("").admin_allowlist == {}


def test_bare_username_routes_to_the_owners_device():
    assert make("cmsal06").admin_allowlist == {"cmsal06": "owner-key"}


def test_explicit_key_overrides_the_owners():
    allowlist = make("cmsal06,sam:sam-key").admin_allowlist
    assert allowlist == {"cmsal06": "owner-key", "sam": "sam-key"}


def test_usernames_are_matched_lowercase():
    # The sign-in form doesn't capitalise (autocapitalize="none"), but a
    # password manager or a desktop browser still might.
    assert make("CMSal06").admin_allowlist == {"cmsal06": "owner-key"}


@pytest.mark.parametrize(
    "value",
    [
        "  cmsal06  ",
        "cmsal06,",
        ",cmsal06",
        "cmsal06,,",
        " cmsal06 , ",
    ],
)
def test_whitespace_and_stray_commas_are_ignored(value):
    assert make(value).admin_allowlist == {"cmsal06": "owner-key"}


def test_key_whitespace_is_stripped():
    assert make("sam: sam-key ").admin_allowlist == {"sam": "sam-key"}


def test_empty_key_after_colon_falls_back_to_the_owner():
    assert make("sam:").admin_allowlist == {"sam": "owner-key"}


def test_entry_with_no_username_is_rejected():
    # ":somekey" would otherwise land as a "" username, and an empty
    # submitted username must never match an allowlist entry.
    with pytest.raises(ValueError, match="no username"):
        make(":orphan-key").admin_allowlist


def test_duplicate_username_is_rejected():
    # Last-one-wins would silently redirect a login code to a different
    # device than the one the first entry named.
    with pytest.raises(ValueError, match="twice"):
        make("sam:key-one,sam:key-two").admin_allowlist


def test_duplicate_detection_is_case_insensitive():
    with pytest.raises(ValueError, match="twice"):
        make("sam,SAM:other-key").admin_allowlist


def test_five_admins_is_allowed():
    allowlist = make("a,b,c,d,e").admin_allowlist
    assert len(allowlist) == Settings.MAX_ADMINS == 5


def test_more_than_five_is_rejected():
    with pytest.raises(ValueError, match="maximum is 5"):
        make("a,b,c,d,e,f").admin_allowlist


def test_a_blank_pushover_key_still_parses():
    # Parsing and delivery are separate concerns: the allowlist is still
    # valid with no Pushover configured, and it's the login route's job to
    # notice it can't actually send (notifier.py no-ops on blank keys).
    assert make("cmsal06", user_key="").admin_allowlist == {"cmsal06": ""}
