# Carlos Tech Solutions

The website for Carlos Tech Solutions — a Gainesville/Miami, FL business that
sells new, used, and refurbished tech (Apple, Dell, and other brands) and
unlocks iCloud/MDM-locked devices. The site lists live inventory, takes
payment for it directly, and collects trade-in and contact leads.

## Tech stack

**Frontend** (`frontend/`)
- [Vite](https://vite.dev) + [React](https://react.dev) + TypeScript
- [React Router](https://reactrouter.com) for client-side routing
- [Tailwind CSS v4](https://tailwindcss.com) for styling
- Deployed as a static build (Vercel)

**Backend** (`backend/`)
- [FastAPI](https://fastapi.tiangolo.com) (Python) serving a small set of
  JSON endpoints behind Caddy (see `deploy/`)
- The catalog is a JSON file (`frontend/src/data/items.json`) validated with
  Pydantic on every read/write, not a database — it's edited locally with
  `backend/scripts/add_item.py` and baked into the static frontend build
- Sold items are tracked in a local JSON store (`backend/data/sold_state.json`)
  so a purchase can hide an item from the shop before the next deploy

## How checkout works (Stripe)

`POST /api/checkout` looks up the requested item **server-side** and creates
a [Stripe Checkout](https://stripe.com/docs/payments/checkout) Session for
it — the price a customer pays always comes from the catalog, never from the
browser. Checkout includes a real shipping rate, a free local-pickup option,
and support for promo codes.

Stripe calls back `POST /api/stripe-webhook` on `checkout.session.completed`.
That handler verifies Stripe's signature against the raw request body, marks
the item sold (so it stops showing as purchasable), and sends two emails
through Resend: a "Congrats" confirmation to the buyer and a "Sold" alert
with the order/shipping details to the shop owner. Webhook events are
deduplicated by event ID so a Stripe retry never double-sends either email.

## How email works (Resend)

All outbound mail goes through one function (`backend/app/mailer.py`) backed
by [Resend](https://resend.com). It's used for:
- The Stripe buyer confirmation and sale alert emails above
- The **Contact** page form (`POST /api/contact`)
- The **Sell your device** trade-in form (`POST /api/trade-in`)
- Newsletter signups (`POST /api/subscribe`)

Contact and trade-in submissions are forwarded to the shop's notification
inbox with `reply_to` set to the customer's email, so replying from the
inbox goes straight back to them. If no Resend API key is configured, emails
are logged instead of sent, so the rest of the app still runs locally.

## Getting started

```bash
# Frontend
cd frontend
npm install
npm run dev

# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

See `docs/LAUNCH_CHECKLIST.md` for required environment variables (Stripe
keys, Resend key, notification addresses) and deployment steps, and
`docs/old/brief.md` for the original project brief (some of it — MongoDB,
Cloudinary, JWT admin — was superseded by what actually shipped).
