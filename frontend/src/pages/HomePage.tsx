import { Link } from "react-router-dom";
import {
  CATEGORIES,
  CONTACT_PHONE,
  CONTACT_PHONE_E164,
  EBAY_PROFILE_URL,
  FACEBOOK_MARKETPLACE_URL,
} from "../lib/constants";
import { PhotoCarousel } from "../components/PhotoCarousel";
import { CleanWayMark } from "../components/CleanWayMark";
import { ProjectsSection } from "../components/ProjectsSection";
import { OtherMarketplaces } from "../components/OtherMarketplaces";

// Four promises shown in the 2x2 grid. The fourth is an autofilled
// placeholder — swap in whatever you actually want to promise.
const PROMISES = [
  {
    title: "Same day shipping",
    body: "Orders placed on a business day go out the same day, with nationwide delivery in 3-4 days.",
  },
  {
    title: "7-day guarantee",
    body: "Not what you expected? Tell us within 7 days of delivery and we'll make it right.",
  },
  {
    title: "All price points available",
    body: "From budget backups under $100 to current-generation flagships — there's something at every price point.",
  },
  {
    title: "Clear transparency",
    body: "Every listing states the real condition, storage, and what's been replaced — no surprises when the box opens.",
  },
];

const SERVICE_LINKS = [
  { label: "Device unlocking", to: "/services" },
  { label: "Repairs", to: "/services" },
  { label: "Sell or trade in", to: "/sell" },
  { label: "All services", to: "/services" },
];

const REPAIRS = ["Cracked screens", "Battery replacements", "Back glass", "No life :("];

// Shared styles for the large pill buttons in the Shop & services section.
const pillButton =
  "group inline-flex items-center gap-2 rounded-full border border-hairline bg-white px-6 py-3 text-[15px] font-medium text-ink transition hover:border-ink hover:bg-ink hover:text-white";

const eyebrow = "text-xs font-semibold tracking-[0.18em] uppercase";
const sectionHeading =
  "text-[clamp(1.75rem,4vw,2.75rem)] leading-[1.05] font-semibold tracking-tight";

export function HomePage() {
  return (
    <div>
      {/* Hero — cream. The headline uses clamp() so it scales with the
          viewport instead of jumping between fixed breakpoints. */}
      <section className="bg-surface">
        <div className="mx-auto max-w-4xl px-6 pt-8 pb-20 text-center sm:pt-12 sm:pb-28">
          {/* Replaces the old header links to PromptWorks/RhinoTrade — those
              didn't fit the utility bar on mobile, and a callout right above
              the headline is more visible than a small link buried in a
              cramped row anyway. Jumps to the projects section further down
              this same page (see id="projects" below).
              Explicit top padding here (not the negative-margin-on-an-
              inline-flex trick tried before — unreliable, and didn't
              actually move anything) plus the h1's mt-8/mt-12 below give a
              controlled 1:2 split of the header-to-headline gap: roughly a
              third above this callout, two-thirds between it and the h1. */}
          {/* Both pills on one row. The contact one used to be a tel: anchor
              nested inside an outer anchor, which isn't legal HTML — browsers
              split it into two sibling links, so the outer pill and the number
              went to different places. It's a single <a> now. */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <a
              href="#projects"
              className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-white px-4 py-1.5 text-xs text-ink transition hover:border-ink"
            >
              <span className="font-bold">Looking for these?</span> PromptWorks &middot; RhinoTrade
              <span aria-hidden>&rarr;</span>
            </a>

            <a
              href={`sms:${CONTACT_PHONE_E164}`}
              className="group inline-flex flex-wrap items-center justify-center rounded-full border border-brand-bright bg-white px-4 py-1.5 text-xs text-brand transition hover:border-brand hover:bg-brand/5 sm:flex-nowrap"
            >
              <span className="font-bold">Contact me directly for latest offerings</span>
              {/* The number unfurls on hover. Its left padding lives inside the
                  clipped box rather than as a flex gap, so there's no ghost
                  space sitting there while it's collapsed.
                  The clipping is sm-and-up only. Phones have no hover, so the
                  number has to be visible there anyway — and leaving
                  overflow-hidden on at that width cropped it to "(305) 763-25"
                  once the label wrapped and ate the room. Below sm the pill
                  wraps instead and the number sits on its own line. */}
              <span className="pl-1.5 font-medium whitespace-nowrap transition-all duration-300 sm:max-w-0 sm:overflow-hidden sm:pl-0 sm:group-hover:max-w-[11rem] sm:group-hover:pl-1.5">
                {CONTACT_PHONE}
              </span>
            </a>
          </div>

          <h1 className="mt-8 text-[clamp(2rem,6.5vw,4.25rem)] leading-[1.02] font-extrabold tracking-tight text-ink sm:mt-12">
            Your one stop shop for all your tech needs
          </h1>
          {/* max-w-3xl, not the 2xl the rest of the page uses: this line wants
              679px and 2xl gives 672, so it was wrapping a lone "time." onto a
              second line. */}
          <p className="mx-auto mt-8 max-w-3xl text-lg leading-relaxed text-muted sm:text-xl">
            Tech repair and resale, done right: fair prices and fast turnarounds, every time!
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/shop"
              className="rounded-full bg-ink px-7 py-3 text-[15px] font-medium text-white hover:opacity-90"
            >
              Shop inventory
            </Link>
            <Link
              to="/services"
              className="rounded-full bg-ink px-7 py-3 text-[15px] font-medium text-white hover:opacity-90"
            >
              View services
            </Link>
          </div>

          {/* Link-out cards rather than embedded reviews — neither eBay nor
              Facebook Marketplace has a public embed widget for profile
              reviews, and showing specific ratings/quotes here without real
              ones to cite would just be making them up. One card split in
              two, stacking on narrow screens. */}
          <div className="mt-16 grid divide-y divide-hairline overflow-hidden rounded-xl border border-hairline bg-white sm:grid-cols-2 sm:divide-x sm:divide-y-0">
            {[
              { href: EBAY_PROFILE_URL, title: "Rated on eBay", sub: "See our feedback on eBay" },
              {
                href: FACEBOOK_MARKETPLACE_URL,
                title: "Rated on Facebook",
                sub: "See our reviews on Facebook Marketplace",
              },
            ].map((review) => (
              <a
                key={review.href}
                href={review.href}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-3 px-6 py-6 text-center transition hover:bg-surface sm:py-8"
              >
                <span aria-hidden className="text-2xl">
                  &#11088;
                </span>
                <span>
                  <span className="block font-semibold text-ink">{review.title}</span>
                  <span className="mt-1 block text-sm text-muted">
                    {review.sub} <span aria-hidden>&rarr;</span>
                  </span>
                </span>
              </a>
            ))}
          </div>

          <PhotoCarousel />
        </div>
      </section>

      {/* What you get — split heading on the left, 2x2 promise grid on the
          right. The grid uses gap-px over a hairline background so the
          dividers between cells are a single crisp line. */}
      <section className="bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className={`${eyebrow} text-muted`}>Why buy from us</p>
            <h2 className={`${sectionHeading} mt-4 text-ink`}>
              What you get,
              <br />
              every time.
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline sm:grid-cols-2">
            {PROMISES.map((promise) => (
              <div key={promise.title} className="bg-white p-6">
                <h3 className="font-semibold text-ink">{promise.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{promise.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Shop & services */}
      <section className="bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className={`${eyebrow} text-muted`}>Shop &amp; services</p>
          <h2 className={`${sectionHeading} mt-4 text-ink`}>Everything we do, in one place.</h2>

          <div className="mt-12 grid gap-12 md:grid-cols-2">
            <div>
              <h3 className="text-lg font-semibold text-ink">Shop</h3>
              <p className="mt-1 text-sm text-muted">Browse by what you&apos;re looking for.</p>
              <div className="mt-5 flex flex-wrap gap-3">
                {CATEGORIES.map((category) => (
                  <Link
                    key={category}
                    to={`/shop?category=${encodeURIComponent(category)}`}
                    className={pillButton}
                  >
                    {category}
                    <span aria-hidden className="inline-block transition-transform group-hover:translate-x-1">
                      &rarr;
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-ink">Services</h3>
              <p className="mt-1 text-sm text-muted">Unlocking, repairs, and trade-ins.</p>
              <div className="mt-5 flex flex-wrap gap-3">
                {SERVICE_LINKS.map((service) => (
                  <Link key={service.label} to={service.to} className={pillButton}>
                    {service.label}
                    <span aria-hidden className="inline-block transition-transform group-hover:translate-x-1">
                      &rarr;
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Other marketplaces — same split as "Why buy from us": heading on the
          left, 2x2 hairline grid on the right. */}
      <section className="border-t border-hairline bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className={`${eyebrow} text-muted`}>Other marketplaces</p>
            <h2 className={`${sectionHeading} mt-4 text-ink`}>
              Already shop
              <br />
              somewhere else?
            </h2>
            <p className="mt-5 max-w-md leading-relaxed text-muted">
              You can find our devices on the marketplaces you already use, too.
            </p>
          </div>

          <OtherMarketplaces />
        </div>
      </section>

      {/* Other projects — replaces the old About Carlos teaser. Shared with
          the Services page via ProjectsSection. */}
      <ProjectsSection id="projects" />

      {/* The Clean Way — full-bleed dark section, centered */}
      <section className="bg-night text-white">
        <div className="mx-auto max-w-3xl px-6 py-24 text-center">
          <p className={`${eyebrow} text-white/50`}>How we source</p>
          <h2 className={`${sectionHeading} mt-4 flex items-center justify-center gap-3`}>
            <CleanWayMark className="h-[0.85em] w-[0.85em]" />
            The Clean Way
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/70">
            Devices sourced from people who no longer need them, plus iCloud/MDM-locked units
            from businesses and schools that would otherwise be scrapped. We verify, unlock,
            and test every one before it&apos;s listed.
          </p>
          <Link
            to="/about#clean-way"
            className="mt-9 inline-block rounded-full bg-white px-7 py-3 text-[15px] font-medium text-night hover:opacity-90"
          >
            Learn about our process
          </Link>
        </div>
      </section>

      {/* Fix your device */}
      <section className="bg-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-20 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className={`${eyebrow} text-muted`}>Repairs</p>
            <h2 className={`${sectionHeading} mt-4 text-ink`}>Broken? We can probably fix it.</h2>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              Send us the details or bring it in. You get a diagnosis and a price up front —
              no work starts until you say go.
            </p>
            <Link
              to="/services"
              className="mt-8 inline-block rounded-full bg-ink px-7 py-3 text-[15px] font-medium text-white hover:opacity-90"
            >
              Get a repair quote
            </Link>
          </div>

          <ul className="divide-y divide-hairline border-y border-hairline">
            {REPAIRS.map((repair) => (
              <li key={repair} className="flex items-center gap-3 py-4 text-ink">
                <span aria-hidden className="text-muted">
                  &mdash;
                </span>
                {repair}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Sell your device — closing CTA, same structure as the sections above */}
      <section className="border-t border-hairline bg-surface">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <p className={`${eyebrow} text-muted`}>Trade-ins</p>
          <h2 className={`${sectionHeading} mt-4 text-ink`}>
            Have a device to sell or trade in?
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted">
            Tell us what you have and get an estimate in minutes. Ship it in or drop it off —
            payment goes out once we&apos;ve checked the device over.
          </p>
          <Link
            to="/sell"
            className="mt-8 inline-block rounded-full bg-ink px-7 py-3 text-[15px] font-medium text-white hover:opacity-90"
          >
            Get a quote
          </Link>
        </div>
      </section>
    </div>
  );
}
