"""Email bodies for the two emails a sale sends (see main.py's webhook).

Kept out of main.py so the handler stays about *what happens* on a sale and
this file is about *what the emails say*. Pure functions — strings in,
strings out — so they can be previewed or tested without Stripe or Resend.

- `buyer_confirmation`: the customer-facing "Congrats!" email. Designed HTML
  (inline styles and tables, because that's all email clients reliably
  render) plus a hand-written plain-text version.
- `sale_alert`: the "Sold" alert to you. Admin-only, so plain text and
  descriptive rather than pretty — everything needed to ship the order.
- `sale_push`: the same sale, cut down to a lock-screen glance for Pushover
  (app/notifier.py). Lives here and not in notifier.py so all the
  Stripe-session shape knowledge stays in one file.
"""

from __future__ import annotations

from html import escape

from .codes import CodeItem
from .models import Item

# Mirrors CONTACT_PHONE in frontend/src/lib/constants.ts.
CONTACT_PHONE = "(305) 763-2541"

_FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"


def format_cents(cents: int) -> str:
    """$1,234 for whole dollars, $1,234.50 otherwise — Item.price_display's
    rule, plus thousands separators."""
    dollars = cents / 100
    return f"${dollars:,.0f}" if cents % 100 == 0 else f"${dollars:,.2f}"


def _shipping_details(session: dict) -> dict:
    """Newer Stripe API versions moved shipping under collected_information;
    check both so an account API-version bump doesn't blank the address."""
    return (
        session.get("shipping_details")
        or (session.get("collected_information") or {}).get("shipping_details")
        or {}
    )


def buyer_confirmation(item: Item | CodeItem, *, amount_paid_cents: int, site_url: str) -> tuple[str, str, str]:
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
      <p style="margin:0;font-size:15px;font-weight:700;">NexFix</p>
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
  <p style="margin:16px 0 0;font-size:12px;color:#999999;">NexFix &middot; Gainesville, FL</p>
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
            "NexFix · Gainesville, FL",
            f"Return policy: {returns_url}",
            f"Privacy policy: {privacy_url}",
        ]
    )
    return subject, html, text


def sale_alert(item: Item | CodeItem, session: dict, *, code: str | None = None) -> tuple[str, str]:
    """Returns (subject, text). `session` is the Checkout Session as a plain
    dict (main.py converts it with .to_dict()). `code` is set for a
    code-only listing (app/codes.py)."""
    customer = session.get("customer_details") or {}
    shipping = _shipping_details(session)
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

    lines = [
        f"{item.name} just sold for {paid} {currency}. It's already marked sold on the site.",
        "",
        "ITEM",
        f"  Name:       {item.name}",
        f"  ID:         {item.id}",
        f"  Condition:  {item.condition.value}",
        f"  Specs:      {item.specLine}",
        f"  Paid:       {paid} {currency}",
        *([f"  Code:       {code} (code-only listing)"] if code else []),
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
        # Plain ID, not a dashboard.stripe.com link — a fresh domain sending
        # an email with an unfamiliar financial-platform link plus dollar
        # amounts is exactly the shape a phishing filter is trained on.
        lines.append(f"  Payment intent ID: {payment_intent}")

    code_note = f" (code {code})" if code else ""
    return f"Sold: {item.name} for {paid}{code_note}", "\n".join(lines)


def sale_push(
    item: Item | CodeItem, session: dict, *, code: str | None = None
) -> tuple[str, str, str | None]:
    """Returns (title, message, url) for the Pushover alert — see notifier.py.
    `code` is set for a code-only listing, same as `sale_alert`.

    Deliberately not the email's contents. This is what's worth reading on a
    lock screen standing in a doorway: what sold, for how much, who to, and
    the inventory number you'd use to find the device. The email has the full
    shipping address and the rest of what packing an order actually needs.

    Unlike `sale_alert` this *does* carry a Stripe dashboard link. The reason
    that link left the email — an unfamiliar domain mailing a financial-
    platform URL next to dollar amounts is the exact shape spam filters look
    for — has no equivalent in a push, and the payment is the one thing you'd
    want to open next.
    """
    paid = format_cents(session.get("amount_total") or item.priceCents)
    customer = session.get("customer_details") or {}
    address = _shipping_details(session).get("address") or {}

    buyer = customer.get("name") or customer.get("email") or "(not given)"
    where = ", ".join(p for p in [address.get("city"), address.get("state")] if p)

    lines = [
        f"{paid} · {item.condition.value}",
        f"Buyer: {buyer}",
        f"Inventory: {item.inventoryId}",
    ]
    if code:
        # A code sale never appeared on the shop, so say so — otherwise I'd
        # go looking for it in the catalog and not find it.
        lines.append(f"Code: {code}")
    if where:
        lines.append(f"Ship to: {where}")

    payment_intent = session.get("payment_intent")
    url = f"https://dashboard.stripe.com/payments/{payment_intent}" if payment_intent else None

    return f"Sold: {item.name}", "\n".join(lines), url


def order_shipped(
    *,
    item_name: str,
    tracking_number: str,
    tracking_url: str,
) -> tuple[str, str, str]:
    """The "your order has shipped" email, sent when a tracking number is
    first saved in the admin panel. Returns (subject, html, text).

    Text-only contact on purpose: it doesn't invite a reply, and the caller
    sends it without a reply-to, so the only way back is the number below.
    """
    subject = "Your order has shipped"
    name = escape(item_name)
    # Grouped in fours, the way the label prints it, so the buyer can match
    # it to the box. The link uses the number unbroken.
    grouped = " ".join(tracking_number[i : i + 4] for i in range(0, len(tracking_number), 4))
    sms = "sms:+1" + "".join(ch for ch in CONTACT_PHONE if ch.isdigit())

    html = f"""<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f6f5f2;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5f2;">
<tr><td align="center" style="padding:32px 16px;font-family:{_FONT};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e7e5e0;border-radius:16px;color:#111111;">
    <tr><td style="padding:32px 32px 0;">
      <p style="margin:0;font-size:15px;font-weight:700;">NexFix</p>
      <h1 style="margin:28px 0 8px;font-size:34px;line-height:1.1;font-weight:800;">Your order has shipped</h1>
      <p style="margin:0;font-size:16px;line-height:1.5;color:#555555;">Your {name} is on its way.</p>
    </td></tr>
    <tr><td style="padding:24px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e7e5e0;border-radius:12px;">
        <tr><td style="padding:20px;">
          <p style="margin:0;font-size:14px;color:#666666;">USPS tracking number</p>
          <p style="margin:4px 0 16px;font-size:17px;font-weight:600;font-family:Menlo,Consolas,monospace;letter-spacing:0.5px;">{escape(grouped)}</p>
          <a href="{escape(tracking_url)}" style="display:inline-block;background:#c2410c;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 22px;border-radius:999px;">View tracking</a>
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:0 32px 32px;font-size:14px;line-height:1.6;color:#555555;">
      <p style="margin:0;">For more information, text us at <a href="{sms}" style="color:#111111;white-space:nowrap;">{CONTACT_PHONE}</a>.</p>
    </td></tr>
  </table>
  <p style="margin:16px 0 0;font-size:12px;color:#999999;">NexFix &middot; Gainesville, FL</p>
</td></tr>
</table>
</body>
</html>"""

    text = "\n".join(
        [
            "Your order has shipped",
            "",
            f"Your {item_name} is on its way.",
            "",
            f"USPS tracking number: {grouped}",
            f"View tracking: {tracking_url}",
            "",
            f"For more information, text us at {CONTACT_PHONE}.",
            "",
            "NexFix · Gainesville, FL",
        ]
    )
    return subject, html, text

