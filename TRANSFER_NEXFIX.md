# Moving the live site to NexFixTech.com

Everything that has to happen on the NUC, and in the dashboards, when the
new domain goes live. Tracks GitHub issue #3.

Work top to bottom. The order matters in two places and both are called out
where they bite.

**Read first — two things that will waste an afternoon if you don't:**

1. **Verify the new domain in Resend before changing `SITE_URL`.** The API
   derives its from-address as `noreply@<SITE_URL's host>` when `FROM_EMAIL`
   is blank (`backend/app/config.py`, `sender_address`). Point `SITE_URL` at
   an unverified domain and *every* outbound email stops — order
   confirmations included — with nothing obviously broken on the site.
2. **Enrol passkeys last.** They are bound to the origin they were created
   on. Anything enrolled on `carlostechsolutions.com` is dead weight on
   `nexfixtech.com` and has to be done again.

---

## 1. Cloudflare — domain and tunnel

- [ ] Add `nexfixtech.com` to the Cloudflare account and finish nameserver
      setup.
- [ ] Zero Trust → Networks → Tunnels → the existing tunnel → **Public
      Hostnames**: point `shop.nexfixtech.com` (or the apex, if that's the
      decision) at `http://ctsb-caddy:80`, exactly as the current hostname is.
- [ ] Leave `TUNNEL_TOKEN` alone. It identifies the tunnel, not the
      hostname — same tunnel, extra hostname, no secret to rotate.
- [ ] Decide what `carlostechsolutions.com` does. Issue #3 says keep it as a
      mirror until it lapses. **Make it a Cloudflare redirect rule to the new
      domain, not a second hostname serving the same app.** Serving both
      means the half that isn't `SITE_URL` gets Stripe redirects bouncing to
      the other domain and no session cookie, because a cookie set on
      nexfixtech.com is never sent to carlostechsolutions.com. A redirect
      keeps old links working with none of that.

## 2. Secrets on the NUC — typed there, never in git

`deploy/.env` is gitignored and lives only on the NUC. Edit it on the box.

- [ ] `ssh` to the NUC, `cd` to the repo, `nano deploy/.env`.
- [ ] **Pushover** — paste the two values you saved privately. Without them,
      admin sign-in returns 503 and nobody can get in: `send_push_strict`
      refuses to claim a code was sent when it wasn't.
      ```
      PUSHOVER_TOKEN=
      PUSHOVER_USER_KEY=
      ```
- [ ] **Admin allowlist** — new variable, nothing works without it.
      ```
      ADMIN_USERNAMES=cmsal06
      ```
      Comma-separated, five maximum. A bare name sends its code to
      `PUSHOVER_USER_KEY` above. A second admin needs their own key after a
      colon (`sam:uQiZ…`), because Pushover delivers to a device, not to a
      username this app invented. Format is documented in
      `deploy/.env.example`.
- [ ] `deploy.sh` warns if `ADMIN_USERNAMES` is empty but still deploys —
      blank is a legitimate "admin sign-in off". Don't skip past the warning
      unless you mean it.

## 3. `SITE_URL` — and the five things that follow from it

**Do Resend verification (step 4) before this.**

- [ ] In `deploy/.env`: `SITE_URL=https://shop.nexfixtech.com`
- [ ] Nothing else in the repo needs the hostname. It is the single source
      for all of:

| Derived from `SITE_URL` | Where |
| --- | --- |
| Stripe success / cancel redirects | `backend/app/payments.py` |
| CORS allowed origin | `backend/app/main.py` |
| From-address, when `FROM_EMAIL` is blank | `backend/app/config.py` |
| Links in buyer confirmation emails | `backend/app/emails.py` |
| Session cookie `Secure` flag | `backend/app/config.py` |

- [ ] Keep the `https://` prefix. The `Secure` flag on the admin session
      cookie is switched on by that exact prefix — drop it and the cookie
      goes out unprotected over any plain-http hop.
- [ ] Expect every admin to be signed out by this change. Cookies are scoped
      to a host, so the old ones are never sent to the new domain. Sign in
      again once it's up; nothing is wrong.

## 4. Resend

- [ ] Add and verify `nexfixtech.com` in Resend (DNS records land in
      Cloudflare).
- [ ] Decide the from-address. Leave `FROM_EMAIL` blank to get
      `noreply@<SITE_URL host>` automatically, or set it explicitly. Either
      way the domain must be verified.
- [ ] Customer-facing addresses in `frontend/src/lib/constants.ts`
      (`request@`, `inquiry@`) and `SALE_NOTIFY_EMAIL` / `NOTIFY_EMAIL` still
      point at `carlostechsolutions.com`. They keep working while that domain
      and its Cloudflare Email Routing rules are alive. Moving them is
      step 8 — a separate change, deliberately not bundled with the cutover.

## 5. Stripe

- [ ] Dashboard → Developers → Webhooks → **add a new endpoint** at
      `https://shop.nexfixtech.com/api/stripe-webhook`.
- [ ] Copy its signing secret into `STRIPE_WEBHOOK_SECRET` in
      `deploy/.env`. It is a different secret per endpoint — reusing the old
      one means every webhook fails signature verification, sales stop being
      recorded, and no "Sold" alert ever fires.
- [ ] Keep the old endpoint enabled until the new one has taken a real
      payment, then delete it.
- [ ] Redirect URLs need no dashboard change — they come from `SITE_URL`.

## 6. Deploy

- [ ] On the NUC, from the repo root:
      ```
      git pull && ./deploy/deploy.sh
      ```
- [ ] The script gates on `pytest` and refuses to deploy if it fails, then
      rebuilds the frontend and brings compose up. A broken build blocks the
      deploy on purpose.
- [ ] If it stops on missing config it names the variable. Fix and re-run;
      it's safe to run repeatedly.

## 7. Verify on the live domain

- [ ] `https://shop.nexfixtech.com` loads, NexFix logo and wordmark.
- [ ] `https://shop.nexfixtech.com/api/health` returns `{"status":"ok"}`.
- [ ] Old domain redirects to the new one.
- [ ] **Admin sign-in end to end**: username → push arrives on your phone →
      6-digit code → signed in, header greets you. Then reload the page and
      confirm you're still signed in. Then sign out.
- [ ] Check the cookie in devtools: `HttpOnly` ✓, `Secure` ✓,
      `SameSite=Lax` ✓. `Secure` missing means `SITE_URL` isn't `https://`.
- [ ] A test payment in Stripe test mode: checkout redirects back to the new
      domain, the webhook fires, the item shows Sold, and both the email and
      the Pushover alert arrive.

## 8. Passkeys — only once the domain is final

- [ ] Confirm the hostname is settled. Changing it again after enrolment
      means doing every device over.
- [ ] Enrol from the admin panel's settings screen. **Not built yet** —
      `backend/app/passkeys.py` stores credentials and
      `/api/admin/passkey/begin` answers `"Not enrolled."` honestly until
      something can enrol one.
- [ ] Until then the Pushover code is the only way in, which is also the
      fallback you want when a passkey device is lost.
- [ ] `sessions.json` and `passkeys.json` do not transfer. Sessions expire in
      three days anyway, and passkeys are origin-bound. Both files are
      created empty on first boot.

## 9. Later — the email domain move

Not part of the cutover. Its own change, when `nexfixtech.com` is settled
and Cloudflare Email Routing is configured there.

- [ ] Email Routing rules on `nexfixtech.com` for `request@`, `inquiry@`,
      `sale@`.
- [ ] `frontend/src/lib/constants.ts`: `REQUEST_EMAIL`, `INQUIRY_EMAIL`.
- [ ] `deploy/.env`: `NOTIFY_EMAIL`, `SALE_NOTIFY_EMAIL`, `FROM_EMAIL`.
- [ ] `PROMPTWORKS_URL` still points at
      `promptworks.carlostechsolutions.com` — moving it means moving that
      subdomain too, so it's its own job.
- [ ] Keep the old addresses receiving until the domain actually lapses.

---

## Deliberately unchanged

Worth knowing so you don't go looking:

- **`deploy/Caddyfile`** — listens on `:80` with no hostname anywhere. It
  serves whatever the tunnel sends it, so the domain move needs no edit.
- **`TUNNEL_TOKEN`** — identifies the tunnel, not the hostname.
- **Compose project `ctsb`, containers `ctsb-caddy` / `ctsb-cloudflared` /
  `ctsb-api`** — internal names, invisible to customers. Renaming them
  orphans the `api_data` volume, which is where sold state, codes, sessions
  and passkeys live. Not worth it for a cosmetic win.
- **`CTS-` inventory id prefixes** — already written into existing listings
  and the sold-state store. Changing the prefix for new items only would
  split the id space.
- **The repository and git remote** — cosmetic, and renaming breaks every
  existing clone and link.

## If it goes wrong

The old domain keeps working throughout, as long as you haven't deleted its
tunnel hostname. To fall back: set `SITE_URL` in `deploy/.env` back to the
old value, restore the old `STRIPE_WEBHOOK_SECRET`, and re-run
`./deploy/deploy.sh`. Nothing in `backend/data/` is touched by a deploy, so
sold state and inventory survive either direction.
