import { Link } from "react-router-dom";
import { REQUEST_EMAIL, CONTACT_PHONE } from "../lib/constants";

// DRAFT POLICY — customers will hold you to every line of this. Read it
// before it goes live, especially the restocking fee and the exchange offer.

// The two paths a return can take. Which one applies is the only thing a
// buyer actually needs to work out, so it leads the page.
const PATHS = [
  {
    heading: "You just don't want it",
    blurb: "Nothing wrong with the device — it's simply not for you.",
    highlight: "15% restocking fee",
    terms: [
      "7 days from delivery to start the return",
      "You cover return shipping",
      "Comes back in the condition it shipped in, with any included cables or accessories",
      "Refund goes back to your original payment method, minus the restocking fee",
    ],
  },
  {
    heading: "Something is actually wrong with it",
    blurb: "A hardware fault that wasn't disclosed in the listing.",
    highlight: "No restocking fee",
    terms: [
      "7 days from delivery to start the return",
      "We cover return shipping",
      "Full refund, or swap it for another device of equal or greater value",
      "Tell us what's wrong and we'll sort it out — no argument",
    ],
  },
];

const SECTIONS = [
  {
    heading: "What counts as a fault",
    body: "Anything that stops the device working as described: it won't power on, the battery is far worse than listed, a port or button doesn't work, or it arrives locked when the listing said unlocked. Cosmetic wear that was described in the listing isn't a fault — that's what the condition grade is for.",
  },
  {
    heading: "What isn't covered",
    body: "Accidental damage after delivery — drops, cracked screens, liquid damage — and normal wear such as battery health declining over time.",
  },
  {
    heading: "How to start a return",
    body: "Email or text us with your order details and which of the two cases above applies. We'll confirm the return and send instructions before you ship anything back. If you picked the device up locally, we'll arrange a drop-off instead.",
  },
  {
    heading: "Refunds",
    body: "Once the device arrives and we've checked it over, refunds go back to the original payment method.",
  },
];

export function ReturnPolicyPage() {
  return (
    <div>
      <section className="bg-surface">
        <div className="mx-auto max-w-4xl px-6 py-16 text-center">
          <h1 className="text-[clamp(1.75rem,4vw,2.75rem)] leading-[1.05] font-semibold tracking-tight text-ink">
            Return policy
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted">
            Seven days either way. What it costs you depends on whether the device is faulty or
            simply not for you.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-14">
        <div className="grid gap-5 md:grid-cols-2">
          {PATHS.map((path) => (
            <div key={path.heading} className="flex flex-col rounded-lg border border-hairline p-6">
              <h2 className="font-semibold text-ink">{path.heading}</h2>
              <p className="mt-1 text-sm text-muted">{path.blurb}</p>

              <p className="mt-4 text-xl font-semibold tracking-tight text-ink">
                {path.highlight}
              </p>

              <ul className="mt-4 space-y-2 text-sm text-muted">
                {path.terms.map((term) => (
                  <li key={term} className="flex gap-2">
                    <span aria-hidden className="text-muted/60">
                      —
                    </span>
                    <span className="leading-relaxed">{term}</span>
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
          <p className="text-ink">Need to start a return or report a fault?</p>
          <p className="mt-1 text-sm text-muted">
            Text{" "}
            <a href={`tel:${CONTACT_PHONE}`} className="font-medium text-ink hover:text-brand">
              {CONTACT_PHONE}
            </a>{" "}
            or email{" "}
            <a href={`mailto:${REQUEST_EMAIL}`} className="text-brand hover:underline">
              {REQUEST_EMAIL}
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
