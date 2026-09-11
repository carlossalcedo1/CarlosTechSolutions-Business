import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { INQUIRY_EMAIL, CONTACT_PHONE } from "../lib/constants";

// DRAFT TERMS — like the return policy, customers can hold you to these.
// Read the "as-is" warranty line, the liability cap, and the trade-in
// section closely before this goes live; those are the ones with teeth.

const LAST_UPDATED = "September 11, 2026";

const SECTIONS: Array<{ heading: string; body: ReactNode }> = [
  {
    heading: "Who we are",
    body: "CarlosTechSolutions is run by Carlos Salcedo in Gainesville, FL. These terms apply when you buy from us, sell or trade in a device, or book an unlock or repair. By placing an order or sending us a device, you agree to them.",
  },
  {
    heading: "Listings and condition",
    body: "Most of what we sell is used or refurbished, and each listing is a single, specific device. The photos, condition grade, and specs describe that exact unit, including any cosmetic wear. Devices are factory unlocked unless the listing says otherwise.",
  },
  {
    heading: "Prices and payment",
    body: "Prices are in US dollars. Card payments go through Stripe at checkout. For local pickup, we also take Cash App, Venmo, Apple Pay, Zelle, or cash.",
  },
  {
    heading: "When we can cancel an order",
    body: "We also sell in person, so a device can occasionally sell elsewhere before a listing comes down. If that happens, or if a listing had an obvious pricing error, we'll cancel your order and refund you in full. If you want to cancel or change an order, message us as soon as you can. We can usually make changes before the order ships.",
  },
  {
    heading: "Shipping and pickup",
    body: "We ship within the US only. Orders placed on a business day usually ship the same day, and delivery usually takes 3–4 days, but carrier times are estimates, not guarantees. If your package is lost or arrives damaged, contact us right away and we'll work it out with you and the carrier. For local pickup, you can test the device before you pay.",
  },
  {
    heading: "Returns",
    body: (
      <>
        You have 7 days from delivery to return a device. The full rules, including when a
        restocking fee applies, are in our{" "}
        <Link to="/returns" className="text-brand hover:underline">
          return policy
        </Link>
        , which is part of these terms.
      </>
    ),
  },
  {
    heading: "Warranty",
    body: "Beyond the 7-day return window, devices are sold as-is. We make no other warranties, express or implied, including any warranty of merchantability or fitness for a particular purpose, to the extent the law allows. If a device still has manufacturer warranty coverage, that coverage comes from the manufacturer, not from us.",
  },
  {
    heading: "Selling or trading in a device",
    body: "Online estimates are not offers. The final offer comes after we inspect the device in person. By sending or bringing us a device, you confirm that you own it and have the right to sell it. We check every IMEI, and we won't buy a device that is reported lost or stolen, blacklisted, or still under financing. We may report it to the authorities if the law requires. You're paid once the device is verified. Remove your accounts and back up your data before handing a device over. We erase every device we buy and can't recover anything left on it.",
  },
  {
    heading: "Unlocking and repairs",
    body: "You get a diagnosis and a price before any repair or unlock work starts. Back up your device first. We take care with every repair, but we're not responsible for data lost during service. Opening a device may void what's left of its manufacturer warranty.",
  },
  {
    heading: "Limitation of liability",
    body: "To the extent the law allows, our total liability for any claim about a purchase, trade-in, or service is limited to the amount you paid us for it, or that we paid you. We're not liable for indirect or consequential losses, such as lost data or lost income.",
  },
  {
    heading: "Governing law",
    body: "These terms are governed by the laws of the State of Florida.",
  },
  {
    heading: "Changes to these terms",
    body: (
      <>
        We may update these terms from time to time. The version that applies is the one posted
        when you placed your order or sent us your device. How we handle your information is
        covered in our{" "}
        <Link to="/privacy" className="text-brand hover:underline">
          privacy policy
        </Link>
        .
      </>
    ),
  },
];

export function TermsPage() {
  return (
    <div>
      <section className="bg-surface">
        <div className="mx-auto max-w-4xl px-6 py-16 text-center">
          <h1 className="text-[clamp(1.75rem,4vw,2.75rem)] leading-[1.05] font-semibold tracking-tight text-ink">
            Terms of service
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted">
            The ground rules for buying, selling, and getting devices fixed with us, in plain
            English.
          </p>
          <p className="mt-3 text-sm text-muted">Last updated {LAST_UPDATED}</p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-14">
        <div className="divide-y divide-hairline border-y border-hairline">
          {SECTIONS.map((section) => (
            <div key={section.heading} className="py-6">
              <h2 className="font-semibold text-ink">{section.heading}</h2>
              <p className="mt-2 leading-relaxed text-muted">{section.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-hairline bg-surface px-6 py-8 text-center">
          <p className="text-ink">Questions about these terms?</p>
          <p className="mt-1 text-sm text-muted">
            Text{" "}
            <a href={`tel:${CONTACT_PHONE}`} className="font-medium text-ink hover:text-brand">
              {CONTACT_PHONE}
            </a>{" "}
            or email{" "}
            <a href={`mailto:${INQUIRY_EMAIL}`} className="text-brand hover:underline">
              {INQUIRY_EMAIL}
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
