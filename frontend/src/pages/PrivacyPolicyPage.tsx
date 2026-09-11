import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { REQUEST_EMAIL, CONTACT_PHONE } from "../lib/constants";

// DRAFT POLICY — written from what the code actually does today (no cookies,
// no analytics, card data only ever at Stripe). If you add analytics, a
// tracking pixel, or a new form, this page has to change with it.

const LAST_UPDATED = "September 11, 2026";

// The three promises most people come to a privacy page to check. They lead
// the page so nobody has to read the whole thing to find them.
const HIGHLIGHTS = [
  {
    heading: "No tracking",
    body: "No cookies, no analytics, no ad pixels. Browsing the site doesn't build a profile of you.",
  },
  {
    heading: "Card details stay at Stripe",
    body: "You pay on Stripe's checkout page. Your card number never reaches our servers.",
  },
  {
    heading: "Never sold",
    body: "We don't sell your information or share it with anyone for advertising.",
  },
];

// One card per way information actually reaches us — mirrors the forms and
// routes in backend/app/main.py.
const COLLECTED = [
  {
    heading: "When you buy",
    items: [
      "Name, email, and shipping address, entered on Stripe's checkout page",
      "Which device you bought and what you paid",
      "Used to ship your order, send your confirmation, and handle returns",
    ],
  },
  {
    heading: "When you contact us or request a repair",
    items: [
      "Name, email, and phone number if you give one",
      "Your message, plus device brand, repair type, and IMEI if you include them",
      "Sent to our inbox so we can reply",
    ],
  },
  {
    heading: "When you sell or trade in",
    items: [
      "Name, email, and phone number if you give one",
      "The device's IMEI, condition, lock status, carrier, and battery health",
      "Used to make an offer and to verify the device isn't lost, stolen, or blacklisted",
    ],
  },
  {
    heading: "When you sign up for new listings",
    items: [
      "Just your email address",
      "Used only to tell you when new inventory is listed",
    ],
  },
];

const SECTIONS: Array<{ heading: string; body: ReactNode }> = [
  {
    heading: "Calls, texts, and local pickup",
    body: "If you call or text us, we'll have your phone number and messages. If you pay at pickup with Cash App, Venmo, Apple Pay, or Zelle, that app shares with us whatever it normally shows the person you're paying, usually your name.",
  },
  {
    heading: "Technical information",
    body: "Like every website, our server sees your IP address when you load a page. It shows up in basic server logs, and we use it briefly to stop bots from flooding our forms. Cloudflare, which protects and routes traffic to the site, also processes it.",
  },
  {
    heading: "Who else handles your information",
    body: "Only the services we need to run the business: Stripe processes payments, Resend delivers our emails, Cloudflare runs our network and DNS, and the shipping carrier gets your address to deliver your order. Each handles your information under its own privacy policy. We'll also share information if the law requires it, for example to help recover a stolen device.",
  },
  {
    heading: "How long we keep it",
    body: "We keep order and trade-in records for as long as we need them for taxes, returns, and payment disputes. Contact messages stay in our inbox. Your new-listing signup stays on file until you unsubscribe.",
  },
  {
    heading: "Your choices",
    body: (
      <>
        You can ask us for a copy of the information we have about you, ask us to correct it, or
        ask us to delete it. To stop new-listing emails, reply to any of them or email{" "}
        <a href={`mailto:${REQUEST_EMAIL}`} className="text-brand hover:underline">
          {REQUEST_EMAIL}
        </a>
        . We'll do it promptly. The only things we won't delete are records the law requires us to
        keep, such as sales records for taxes.
      </>
    ),
  },
  {
    heading: "Security",
    body: "The whole site runs over HTTPS, and payments happen on Stripe's checkout page, not ours. No system is perfectly secure, but we keep as little information as possible, so there's less of it to protect.",
  },
  {
    heading: "Children",
    body: "This site isn't aimed at children under 13, and we don't knowingly collect their information. If you think a child has sent us their details, contact us and we'll delete them.",
  },
  {
    heading: "Changes to this policy",
    body: (
      <>
        If what we collect or how we use it changes, we'll update this page and the date at the
        top. See also our{" "}
        <Link to="/terms" className="text-brand hover:underline">
          terms of service
        </Link>
        .
      </>
    ),
  },
];

export function PrivacyPolicyPage() {
  return (
    <div>
      <section className="bg-surface">
        <div className="mx-auto max-w-4xl px-6 py-16 text-center">
          <h1 className="text-[clamp(1.75rem,4vw,2.75rem)] leading-[1.05] font-semibold tracking-tight text-ink">
            Privacy policy
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted">
            We collect only what we need to sell, ship, buy, and fix devices, and nothing more.
          </p>
          <p className="mt-3 text-sm text-muted">Last updated {LAST_UPDATED}</p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-14">
        <div className="grid gap-5 md:grid-cols-3">
          {HIGHLIGHTS.map((highlight) => (
            <div key={highlight.heading} className="rounded-lg border border-hairline p-6">
              <p className="text-xl font-semibold tracking-tight text-ink">{highlight.heading}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">{highlight.body}</p>
            </div>
          ))}
        </div>

        <h2 className="mt-14 text-xl font-semibold tracking-tight text-ink">What we collect</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          {COLLECTED.map((group) => (
            <div key={group.heading} className="rounded-lg border border-hairline p-6">
              <h3 className="font-semibold text-ink">{group.heading}</h3>
              <ul className="mt-4 space-y-2 text-sm text-muted">
                {group.items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span aria-hidden className="text-muted/60">
                      —
                    </span>
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 divide-y divide-hairline border-y border-hairline">
          {SECTIONS.map((section) => (
            <div key={section.heading} className="py-6">
              <h2 className="font-semibold text-ink">{section.heading}</h2>
              <p className="mt-2 leading-relaxed text-muted">{section.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-hairline bg-surface px-6 py-8 text-center">
          <p className="text-ink">Questions about your information, or want it deleted?</p>
          <p className="mt-1 text-sm text-muted">
            Email{" "}
            <a href={`mailto:${REQUEST_EMAIL}`} className="text-brand hover:underline">
              {REQUEST_EMAIL}
            </a>{" "}
            or text{" "}
            <a href={`tel:${CONTACT_PHONE}`} className="font-medium text-ink hover:text-brand">
              {CONTACT_PHONE}
            </a>
            .
          </p>
          <Link
            to="/contact"
            className="mt-5 inline-block rounded-full bg-ink px-7 py-3 text-[15px] font-medium text-white hover:opacity-90"
          >
            Contact us
          </Link>
        </div>
      </section>
    </div>
  );
}
