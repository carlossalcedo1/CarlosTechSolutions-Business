# Launch checklist

Everything between here and taking real money. Ordered so each phase unblocks
the next — you can test payments without a server, but you can't test the
webhook without one.

---

## Where things stand

**Done**

- [x] Frontend — every page, static build, ~85KB gzipped
- [x] Catalog — `items.json`, validated by a shared Pydantic model
- [x] `add_item.py` CLI — HEIC/EXIF/resize handled, photos render on the site
- [x] Prices stored as integer cents (Stripe-native, no float bugs)
- [x] `request@` / `inquiry@` wired through the UI
- [x] Domain + Cloudflare DNS
- [x] Stripe dashboard account
- [x] Server running Docker + Caddy
- [x] Everything committed to git (Phase 0)
- [x] Backend service skeleton — all 5 routes, builds + smoke-tested in Docker (Phase 1)

**Not built yet**

- [ ] Real Stripe keys wired in (routes exist, return 500 until `STRIPE_SECRET_KEY` /
      `STRIPE_WEBHOOK_SECRET` are set)
- [ ] Real Resend key wired in (routes exist, skip sending until `RESEND_API_KEY` is set)
- [ ] Any real payment
- [ ] Deploy pipeline (docker-compose + Caddy integration — Phase 5)

---

## Phase 0 — Commit what exists

Your entire frontend rewrite, the CLI, and the backend models are uncommitted.
One bad `rm` and it's gone.

- [x] `git add -A && git commit` the current state
- [x] Confirm `backend/.env` is in `.gitignore` **before** any secret exists
- [ ] Push to a remote (private repo) so the laptop isn't the only copy —
      `origin` is already set (github.com/carlossalcedo1/CarlosTechSolutions-Business),
      this box just has no push credentials yet; push from wherever does

---

## Phase 1 — The backend service

A FastAPI container behind Caddy. Five routes:

| Route | Does | Needs |
|---|---|---|
| `POST /api/checkout` | Look up real price, create Stripe Checkout Session | Stripe secret key |
| `POST /api/stripe-webhook` | Payment confirmed → mark sold, send emails | Webhook signing secret |
| `POST /api/contact` | Contact / repair / unlock form → email you | Resend key |
| `POST /api/trade-in` | Trade-in submission → email you | Resend key |
| `POST /api/subscribe` | Record the email (real Resend audience is a Stretch goal, below) | — |

- [x] FastAPI app skeleton, loading `items.json` through `load_catalog()` at boot
      so a corrupt catalog fails at startup instead of at checkout
- [x] Sold-state store — JSON on a mounted volume (`backend/data/`, gitignored)
- [x] CORS locked to your own domain only (`SITE_URL`)
- [x] Health endpoint for the container (`GET /api/health`)

**Two rules that matter more than the rest:**

1. **Never trust a price from the browser.** `/api/checkout` takes an item *id*
   and reads the price server-side. If the client sends the amount, someone
   sends `$1.00` and legally owns your MacBook.
2. **The webhook needs the raw request body.** Stripe's signature is computed
   over exact bytes. If FastAPI parses the JSON first, verification fails and
   you'll waste an afternoon on it. This is the single most common Stripe bug.

---

## Phase 2 — Email (Resend)

### Sending at all

- [x] Add Resend's SPF + DKIM records in Cloudflare, verify the domain — done
      via a `send.` subdomain (Resend's current pattern): DKIM at
      `resend._domainkey`, SPF + bounce MX at `send.carlostechsolutions.com`,
      confirmed directly against Cloudflare's authoritative NS. The apex's own
      MX/SPF are Cloudflare Email Routing's (receiving), untouched — no conflict.
      DMARC added: `v=DMARC1; p=none; rua=mailto:request@carlostechsolutions.com`
      (monitor-only for now — Cloudflare showing "policy: None" is the record
      working as intended, not an error. Tighten to `quarantine` after a
      couple weeks of clean reports.)
- [x] Confirm `request@` and `inquiry@` actually **receive** mail — confirmed
- [x] Send yourself a test from each address before launch — confirmed:
      `/api/contact` and `/api/trade-in` both landed real emails at
      `request@carlostechsolutions.com` via Resend

### "Sending email from the frontend"

Worth being precise: **the frontend never sends email.** It can't — the Resend
API key would be visible to anyone who opens devtools, and within days you'd be
someone's spam relay.

The real flow is:

```
form submit → POST /api/contact → server holds the key → Resend → your inbox
```

- [ ] Wire `/api/contact`, `/api/trade-in`, `/api/subscribe` to Resend
- [ ] Set `reply_to` to the customer's address so you can reply straight from
      your inbox instead of copy-pasting
- [ ] Include the structured fields the forms already collect (repair type,
      device brand, IMEI, phone) as labelled lines — not buried in prose
- [ ] **Honeypot field + rate limit.** A public POST endpoint attached to an
      email sender gets found by bots. A hidden field real users never fill in
      catches most of it; a per-IP limit catches the rest
- [ ] Sanity-check: no HTML injection from form input into the email body

> **Marketing email (new-listing digest) moved to Stretch goals** — see the
> bottom of this file. `/api/subscribe` still needs to exist for Phase 1/4 (the
> subscribe box has to POST *somewhere* and get a real success state), but it
> can just record the email for now; the Resend Audience, double opt-in, and
> actual sends aren't launch-blocking.

---

## Phase 3 — Payments (Stripe)

- [x] Build `/api/checkout` in **test mode** first (`sk_test_...`)
- [x] Test webhooks locally with the Stripe CLI (`stripe listen --forward-to`)
      — no deploy needed to iterate. Gotcha hit and worth remembering: your
      Stripe login has more than one sandbox, and `stripe login`'s OAuth
      pairing landed on a *different* one than the `sk_test_` key in
      `backend/.env` belongs to — `stripe listen`/`events` silently saw nothing
      because they were watching the wrong account. Fix was `--api-key` on
      every CLI call to pin it to the same key the app uses.
- [x] Collect shipping address in Checkout for shipped orders — confirmed live
      in the actual test session (real address collected at checkout)
- [x] Handle `checkout.session.completed`: mark sold, email buyer, email you
      — caught and fixed a real bug here, see the `c2f402a` commit: the
      handler 500'd on every real event before this fix
- [x] **Make the webhook idempotent.** — verified: redelivering the same
      event twice only processes it once
- [ ] Turn on Stripe's own receipt emails — dashboard setting, not code
- [x] Test the full path with card `4242 4242 4242 4242` — real test-mode
      purchase completed (USB-C Hub, $29.00), confirmed `paid`/`complete`
      directly via the Stripe API
- [x] Test the **already-sold** path: two checkouts on one device, second one
      must be refused before payment — confirmed: second `/api/checkout` on
      the now-sold item returns 409 before Stripe is ever called

### Then, to accept real money

- [ ] Activate the account: identity verification, bank details
- [ ] Swap to live keys, held only in the server `.env`
- [ ] Register the live webhook endpoint URL in the Stripe dashboard
- [ ] One real £/$ transaction to yourself, then refund it

---

## Phase 4 — Frontend wiring

Right now every form fakes success in local state. Each needs to hit the API,
and each needs the three states it currently doesn't have.

- [x] `Buy now` → `POST /api/checkout` → redirect to Stripe
- [x] Contact / repair / unlock form → `POST /api/contact`
- [x] Trade-in form → `POST /api/trade-in` — rebuilt as a plain form (name,
      email, phone, IMEI, condition, unlock status, notes) instead of the old
      5-step price-estimate wizard, with an Apple-only notice; backend
      schema changed to match (`imei` + `unlock_status`, dropped the
      client-side "estimated offer" concept entirely)
- [x] Subscribe box → `POST /api/subscribe`
- [x] **Loading, error, and success states for all four.** — `lib/api.ts`
      centralizes error-message extraction (FastAPI validation arrays vs.
      plain `detail` strings) so every form shows a real message, not a
      silent failure
- [x] Disable submit while in flight so double-clicks don't double-send
- [x] `/checkout/success` and `/checkout/cancelled` pages for Stripe's redirects
      — plain confirmation pages, no API calls; the webhook is still the
      real source of truth, not this page

---

## Phase 5 — Server and deploy

- [ ] `docker-compose.yml` for the API, joined to Caddy's existing network
- [ ] `backend/.env` on the server — `chmod 600`, never in git
- [ ] Caddyfile block: static site from a directory, `reverse_proxy /api/*` to
      the container
- [ ] Deploy script: `npm run build` → rsync `dist/` to a timestamped dir →
      **symlink swap**. The swap is what makes deploys atomic, so visitors
      never see a half-copied site
- [ ] Rollback: keep the last few builds so reverting is one symlink change

**Cloudflare + Caddy gotcha:** if the orange cloud is on, Cloudflare terminates
TLS and Caddy's automatic certificate can conflict. Either set the record to
DNS-only, or use Full (strict) with a Cloudflare Origin certificate. Also make
sure `/api/*` isn't cached — a cached checkout response would be its own
adventure.

- [ ] Confirm the Stripe webhook URL is reachable from outside (Stripe's
      dashboard has a test-send button)

---

## Phase 6 — Before real money moves

- [ ] **Terms of service** and **privacy policy** pages — Stripe expects them,
      and the privacy policy is not optional once you're collecting emails
- [ ] Review the return policy line by line. It's a draft I wrote; you'll be
      held to the 15% restocking fee and the "equal or greater value" swap
- [ ] Sales tax on Florida buyers — Stripe Tax can calculate it, but *whether
      you must collect* is a question for an accountant, not for code
- [ ] Keep your Clean Way paperwork (proof of purchase, IMEI checks). Chargeback
      disputes on used electronics are decided on the seller's evidence

---

## Phase 7 — Content

- [ ] Replace the 13 mock items with real inventory (`add_item.py`)
- [ ] Real photos — the placeholder boxes are the most obvious "unfinished" tell
- [ ] Write the About page bio (still placeholder text)
- [ ] Logo mark for the reserved slot in the header and footer
- [ ] Rewrite the Services and RhinoTrade copy in your own voice
- [ ] PromptWorks URL into `projects.ts` so those links go somewhere

---

## Environment variables

All server-side. None of these ever reach the browser.

| Variable | Where from |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe dashboard → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | Created when you register the webhook endpoint |
| `RESEND_API_KEY` | Resend dashboard |
| `RESEND_AUDIENCE_ID` | Resend → Audiences |
| `NOTIFY_EMAIL` | Where form notifications land |
| `SITE_URL` | For Stripe redirect URLs and email links |

---

## Launch day

- [ ] Every page loads on a real phone, not just a resized browser
- [ ] Submit every form once and confirm the email arrives
- [ ] Buy something with a real card, then refund it
- [ ] Check the sold item disappeared from the shop
- [ ] Confirm `request@` and `inquiry@` both deliver
- [ ] Analytics (Cloudflare Web Analytics is free and needs no cookie banner)

## Shortly after

- [ ] Back up the sold-state file — the catalog is in git, that file isn't
- [ ] Uptime monitoring — self-hosted means nobody else notices it's down
- [ ] A `mark_sold.py` CLI for devices you sell in person, off-site

---

## Stretch goals (post-launch)

Not required to take real money. Do these once the core loop (browse → buy →
get paid, forms → email) is working and boring.

### Marketing email (new listings)

Different from transactional email, and legally so — don't build this casually.

- [ ] Create a Resend Audience; `/api/subscribe` adds contacts to it for real
      (Phase 1/4 only needs it to record the email and return success)
- [ ] Double opt-in (confirm by email) — protects your sending reputation from
      people typing other people's addresses
- [ ] **Unsubscribe link in every marketing send.** Resend audiences handle
      this; it is a legal requirement under CAN-SPAM, not a courtesy
- [ ] **A physical mailing address in every marketing email.** Also legally
      required. A PO box is fine
- [ ] Decide what triggers a send — weekly digest beats per-item, which trains
      people to ignore you
- [ ] Watch the free tier: ~3,000/month and ~100/day. 100 subscribers × weekly
      is comfortable; a daily blast to 200 is not

### Prettier email

- [x] Plain-text alternative alongside HTML — done now (small spam-score
      signal, cheap to fix): `mailer.send_email` auto-derives a text part
      from the HTML body unless one is passed explicitly
- [ ] Actual designed HTML templates instead of plain `<p>` paragraphs
- [ ] BIMI (logo next to the email in the inbox) — needs DMARC at
      `quarantine`/`reject` (we're at `none` on purpose for now) and, to
      actually render in Gmail, a paid Verified Mark Certificate tied to a
      registered trademark. Skip unless that math changes.
