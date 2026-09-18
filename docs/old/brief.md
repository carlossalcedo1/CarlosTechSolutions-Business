# Carlos Tech Solutions — website design brief

Context handoff document. Everything below was decided in a planning conversation before implementation started. Stage 1 = frontend only (mock/static data). Stage 2 = backend + Notion sync.

## Business

- Sells new, used, and refurbished tech: Apple, Dell, and other brands.
- Services: unlocking iCloud/MDM-locked devices, general device sales.
- Based in Gainesville and Miami, FL. Ships nationwide (3-4 day shipping).
- Every device is factory unlocked unless specified.
- "The Clean Way" — the sourcing/mission story: devices come from people who no longer need them (instead of being thrown away), plus iCloud/MDM-locked devices from businesses and schools retiring their fleets, which would otherwise become e-waste. Devices are verified and unlocked before listing.
- Site doubles as a landing page for Facebook Marketplace buyers (see full catalog, not just one listing) and is recruiter-facing (owner's technical background matters — keep this understated, lives on the About page, not the homepage).

## Tagline / copy already decided

- Homepage H1: "Carlos Tech Solutions"
- Subhead: "New, used, and recycled tech for an affordable audience"
- Supporting line: "Every device is factory unlocked unless specified."
- Trust badges (3): "Factory unlocked" / "Nationwide 3-4 day shipping" / "New, used, refurb - low prices"

## Tech stack

- Frontend: React, hosted free on Vercel.
- Backend (stage 2): Python, FastAPI recommended (auto validation + docs), hosted free on Render.
- Database (stage 2): MongoDB Atlas, free M0 cluster.
- Images (stage 2): Cloudinary free tier — store URLs in Mongo, not raw files.
- Email notifications (stage 2): TBD — Resend or SendGrid free tier, for trade-in leads and contact form submissions.

## Site map

1. Homepage
2. Shop / inventory (category + brand + condition + price filters)
3. Product detail page
4. Sell your device (trade-in flow: device type -> condition -> offer -> ship/drop off -> get paid)
5. About (bio + full "The Clean Way" story + warranty/trust info)
6. Contact (form + direct email/phone + two locations)
7. Help center (FAQ search + category tags + contact fallback)
8. Global header + footer (present on every page)

## Global header — 3 rows, finalized

**Row 1 (utility bar):** left: "The Clean Way" (links to About's mission section), "Need help?", "For business". Right: "Gainesville and Miami, FL", "English | Español".

**Row 2 (main row):** logo (space reserved to the left of the wordmark for a custom logo mark), "Carlos Tech Solutions" wordmark, search bar ("Search for iPhone, MacBook, Dell..."), "Sell your device" button (bordered, styled like a real CTA), account icon.

**Row 3 (nav row):** left: Shop, About, Contact. Right (quiet/muted): Phones · Tablets · Laptops · Desktops · Accessories.

## Homepage section order

1. Header (3-row, above)
2. Hero: H1 + subhead + supporting line + two CTAs ("Shop inventory", "Get a quote for your device") + image carousel
3. Trust badges row (3 items, see copy above)
4. Shop by category (5 category tiles: Phones, Tablets, Laptops, Desktops, Accessories)
5. Recently listed (grid of newest items — this is the bridge for Facebook Marketplace traffic)
6. About Carlos teaser (photo + short bio, links to full About page)
7. The Clean Way teaser (short version of the sourcing story, links to About page for the full version)
8. Sell your device CTA banner
9. Footer

## Footer — 4 columns

1. Business name + one-line tagline
2. Shop: Phones / Laptops / Desktops
3. Support: Help center / Warranty / Contact
4. Reach us: Gainesville and Miami, FL / email / phone

## Shop / inventory page

- Filter chips: All, Phones, Tablets, Laptops, Desktops, Accessories
- Sort/filter: Brand, Condition, Price
- Card grid: image, name, spec line, condition badge (Good/Excellent/Fair/New), price

## Product detail page

- Breadcrumb: Home > Shop > Category > Item name
- Left: main image + thumbnail strip
- Right: name, price, condition badge, spec bullets, "Add to cart" + "Message seller" buttons, shipping/warranty note

## Backend plan (stage 2 — not started yet)

**MongoDB collections:**
- `items` — inventory. Fields: name, sku, category, brand, condition, price, description, specs, images[], status (active/archived/sold — no separate archive collection), location, factoryUnlocked, featured, dateAdded
- `trade_in_submissions` — device info, contact info, status (pending/quoted/accepted), quoted price
- `contact_messages` — name, email, message, status (new/read)
- `knowledge_articles` — title, slug, body, category, tags (powers the help center)
- `locations` — Gainesville and Miami entries: address, hours, phone, coordinates

**API surface (rough):** public reads (`GET /items`, `/items/{id}`, `/locations`, `/articles`), public writes (`POST /trade-in`, `POST /contact` — no auth needed), admin-only writes behind a single JWT login (`POST/PATCH /items`, `PATCH /trade-in/{id}`, read leads/messages).

**Auth:** single admin (the owner), JWT-based, no customer accounts needed yet.

## Notion integration (stage 2, deferred)

- Owner currently manages inventory in Notion — an "iPad & iPhone Inventory" database with columns including Name, Type, Condition (A-Like New/B-Good/C-Fair/D-Parts Only), Status (Unsold/Sold/Repair-Pending/etc.), Storage, Color, Purchase Price + Parts, Serial Number, Bypass Method, Original Seller, Sold To.
- Plan: one-way sync (Notion -> Mongo via scheduled script), NOT two-way. Notion stays the editing source.
- Only whitelist public-safe fields into Mongo (name, category, condition, price, storage, color). Keep cost, profit, serial number, original seller, sold-to, and bypass-method detail internal-only — never synced to the public site.
- No image/file property exists in the current Notion database yet — needs to be added. Note: Notion file URLs are temporary signed links (~1hr expiry), so the sync job must download and re-host images (e.g. to Cloudinary), never store the Notion URL directly.
- Current Notion database is iPad/iPhone-specific. Needs either a unified database (add Category + Brand properties) or multiple per-category databases feeding the same Mongo collection, since the business now also sells Dell and other brands.
- Status field needs a mapping layer: only "Unsold" should show as purchasable on the public site.
- Open item: how locked devices are verified as legitimately sourced before unlocking — worth a "Verification" field/process in Notion (proof of purchase, liquidation manifest, IMEI check) both for accurate "Clean Way" messaging and the owner's own risk management.

## Hosting (all free tier)

Vercel (frontend) + Render (backend, stage 2) + MongoDB Atlas (stage 2) + Cloudinary (stage 2, images). Custom domain is the one likely future cost (~$10-15/year).

## Reference files

A full wireframe sketch PDF (9 pages: header, homepage, shop, product detail, sell your device, about, contact, help center, footer) was produced earlier in the design conversation and should be available in the project's saved files.
