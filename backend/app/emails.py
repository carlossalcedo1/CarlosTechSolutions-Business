"""Email bodies for the two emails a sale sends (see main.py's webhook).

Kept out of main.py so the handler stays about *what happens* on a sale and
this file is about *what the emails say*. Pure functions — strings in,
strings out — so they can be previewed or tested without Stripe or Resend.

- `buyer_confirmation`: the customer-facing "Congrats!" email. Designed HTML
  (inline styles and tables, because that's all email clients reliably
  render) plus a hand-written plain-text version.
- `sale_alert`: the "Sold" alert to you. Admin-only, so plain text and
  descriptive rather than pretty — everything needed to ship the order.
"""

from __future__ import annotations

from html import escape

from .models import Item

# Mirrors CONTACT_PHONE in frontend/src/lib/constants.ts.
CONTACT_PHONE = "(305) 763-2541"

_FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"


def format_cents(cents: int) -> str:
    """$1,234 for whole dollars, $1,234.50 otherwise — Item.price_display's
    rule, plus thousands separators."""
    dollars = cents / 100
    return f"${dollars:,.0f}" if cents % 100 == 0 else f"${dollars:,.2f}"


def buyer_confirmation(item: Item, *, amount_paid_cents: int, site_url: str) -> tuple[str, str, str]:
    """Returns (subject, html, text)."""
    paid = format_cents(amount_paid_cents)
    returns_url = f"{site_url}/returns"
    privacy_url = f"{site_url}/privacy"

    subject = f"Congrats on your {item.name}!"

    name = escape(item.name)
    details = escape(f"{item.specLine} · {item.condition.value}")

    html = f"""<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f6f5f2;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5f2;">
<tr><td align="center" style="padding:32px 16px;font-family:{_FONT};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e7e5e0;border-radius:16px;color:#111111;">
    <tr><td style="padding:32px 32px 0;">
      <p style="margin:0;font-size:15px;font-weight:700;">CarlosTechSolutions</p>
      <h1 style="margin:28px 0 8px;font-size:34px;line-height:1.1;font-weight:800;">Congrats!</h1>
      <p style="margin:0;font-size:16px;line-height:1.5;color:#555555;">Your order is confirmed &mdash; the {name} is yours.</p>
    </td></tr>

    <tr><td style="padding:24px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e7e5e0;border-radius:12px;">
        <tr><td style="padding:20px;">
          <p style="margin:0;font-size:17px;font-weight:600;">{name}</p>
          <p style="margin:4px 0 0;font-size:14px;color:#666666;">{details}</p>
        </td></tr>
        <tr><td style="padding:16px 20px;border-top:1px solid #e7e5e0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:14px;color:#666666;white-space:nowrap;">Price paid</td>
              <td align="right" style="font-size:22px;font-weight:700;white-space:nowrap;">{paid}</td>
            </tr>
          </table>
        </td></tr>
      </table>
    </td></tr>

    <tr><td style="padding:0 32px 32px;font-size:14px;line-height:1.6;color:#555555;">
      <p style="margin:0 0 12px;"><strong style="color:#111111;">What happens next:</strong> we&rsquo;ll pack it up and ship it. Orders placed on a business day go out the same day. Stripe will email your receipt separately.</p>
      <p style="margin:0;">Questions? Reply to this email or text <span style="white-space:nowrap;">{CONTACT_PHONE}</span>.</p>
    </td></tr>
  </table>
  <p style="margin:16px 0 0;font-size:12px;color:#999999;">CarlosTechSolutions &middot; Gainesville, FL</p>
  <p style="margin:8px 0 0;font-size:12px;">
    <a href="{escape(returns_url)}" style="color:#999999;">Return policy</a>
    &nbsp;&middot;&nbsp;
    <a href="{escape(privacy_url)}" style="color:#999999;">Privacy policy</a>
  </p>
</td></tr>
</table>
</body>
</html>"""

    text = "\n".join(
        [
            "Congrats!",
            "",
            f"Your order is confirmed — the {item.name} is yours.",
            "",
            item.name,
            f"{item.specLine} · {item.condition.value}",
            f"Price paid: {paid}",
            "",
            "What happens next: we'll pack it up and ship it. Orders placed on a "
            "business day go out the same day. Stripe will email your receipt separately.",
            "",
            f"Questions? Reply to this email or text {CONTACT_PHONE}.",
            "",
            "CarlosTechSolutions · Gainesville, FL",
            f"Return policy: {returns_url}",
            f"Privacy policy: {privacy_url}",
        ]
    )
    return subject, html, text


def sale_alert(item: Item, session: dict) -> tuple[str, str]:
    """Returns (subject, text). `session` is the Checkout Session as a plain
    dict (main.py converts it with .to_dict())."""
    customer = session.get("customer_details") or {}
    # Newer Stripe API versions moved shipping under collected_information;
    # check both so an account API-version bump doesn't blank this section.
    shipping = (
        session.get("shipping_details")
        or (session.get("collected_information") or {}).get("shipping_details")
        or {}
    )
    address = shipping.get("address") or {}

    paid = format_cents(session.get("amount_total") or item.priceCents)
    currency = (session.get("currency") or "usd").upper()

    state_zip = " ".join(p for p in [address.get("state"), address.get("postal_code")] if p)
    city_line = ", ".join(p for p in [address.get("city"), state_zip] if p)
    ship_to = [
        line
        for line in [
            shipping.get("name"),
            address.get("line1"),
            address.get("line2"),
            city_line,
            address.get("country"),
        ]
        if line
    ] or ["(no shipping address on the session)"]

    payment_intent = session.get("payment_intent")
    dashboard = "https://dashboard.stripe.com/" + ("" if session.get("livemode") else "test/")

    lines = [
        f"{item.name} just sold for {paid} {currency}. It's already marked sold on the site.",
        "",
        "ITEM",
        f"  Name:       {item.name}",
        f"  ID:         {item.id}",
        f"  Condition:  {item.condition.value}",
        f"  Specs:      {item.specLine}",
        f"  Paid:       {paid} {currency}",
        "",
        "BUYER",
        f"  Name:   {customer.get('name') or '(not given)'}",
        f"  Email:  {customer.get('email') or '(not given)'}",
        f"  Phone:  {customer.get('phone') or '(not given)'}",
        "",
        "SHIP TO",
        *(f"  {line}" for line in ship_to),
        "",
        "STRIPE",
        f"  Checkout session:  {session.get('id')}",
        f"  Payment status:    {session.get('payment_status')}",
    ]
    if payment_intent:
        lines.append(f"  Payment:           {dashboard}payments/{payment_intent}")

    return f"Sold: {item.name} for {paid}", "\n".join(lines)
