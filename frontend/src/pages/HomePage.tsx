import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { items } from "../data/items";
import { CATEGORIES } from "../lib/constants";
import { ProductCard } from "../components/ProductCard";
import { PlaceholderImage } from "../components/PlaceholderImage";
import { CleanWayMark } from "../components/CleanWayMark";
import { ProjectsSection } from "../components/ProjectsSection";
import { subscribe, ApiError } from "../lib/api";
import { useSoldItemIds } from "../lib/useSoldItemIds";

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
    body: "From budget backups under $100 to current-generation flagships — there's something at every budget.",
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
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [subscribeError, setSubscribeError] = useState<string | null>(null);

  const soldIds = useSoldItemIds();
  // Sold items skip this teaser entirely rather than showing a badge here —
  // it's a "what's new" highlight strip, not the full catalog, so a sold
  // item just falls out and the next one takes its place. The full catalog
  // (ShopPage) still shows sold items with a badge instead of removing them.
  const recentlyListed = [...items]
    .filter((item) => !soldIds.has(item.id))
    .sort((a, b) => (a.dateAdded < b.dateAdded ? 1 : -1))
    .slice(0, 4);

  async function handleSubscribe(e: FormEvent) {
    e.preventDefault();
    if (subscribing) return;
    setSubscribeError(null);
    setSubscribing(true);
    try {
      await subscribe(email);
      setSubscribed(true);
    } catch (err) {
      setSubscribeError(
        err instanceof ApiError ? err.message : "Something went wrong — try again in a moment.",
      );
    } finally {
      setSubscribing(false);
    }
  }

  return (
    <div>
      {/* Hero — cream. The headline uses clamp() so it scales with the
          viewport instead of jumping between fixed breakpoints. */}
      <section className="bg-surface">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center sm:py-28">
          <h1 className="text-[clamp(2rem,6.5vw,4.25rem)] leading-[1.02] font-extrabold tracking-tight text-ink">
            Your one stop shop for all your tech needs
          </h1>
          {/* Placeholder description — rewrite this in your own voice. */}
          <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-muted sm:text-xl">
            New, used, and refurbished phones, tablets, and computers — tested, unlocked,
            and priced to move. We also buy, trade, and repair.
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

          <PlaceholderImage label="image carousel" className="mt-16 h-56 w-full rounded-xl sm:h-72" />
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

      {/* Recently listed */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-2xl font-bold tracking-tight text-ink">Recently listed</h2>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {recentlyListed.map((item) => (
              <ProductCard key={item.id} item={item} />
            ))}
          </div>

          {/* New-listing email signup */}
          <div className="mx-auto mt-12 max-w-xl rounded-2xl border border-hairline bg-surface px-6 py-8 text-center">
            <p className="text-sm leading-relaxed text-muted">
              New inventory lands all the time. Want an email when something you&apos;re looking
              for gets listed? Subscribe below — just new listings, no spam.
            </p>

            {subscribed ? (
              <p className="mt-5 text-sm font-medium text-ink">
                You&apos;re on the list — we&apos;ll email you when new items land.
              </p>
            ) : (
              <form
                onSubmit={handleSubscribe}
                className="mt-5 flex flex-col items-center justify-center gap-2 sm:flex-row"
              >
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  className="w-full rounded-full border border-hairline bg-white px-4 py-2.5 text-sm outline-none focus:border-brand sm:w-64"
                />
                <button
                  type="submit"
                  disabled={subscribing}
                  className="w-full rounded-full bg-ink px-6 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {subscribing ? "Subscribing…" : "Subscribe"}
                </button>
              </form>
            )}
            {subscribeError && (
              <p className="mt-3 text-sm text-red-700">{subscribeError}</p>
            )}
          </div>
        </div>
      </section>

      {/* Other projects — replaces the old About Carlos teaser. Shared with
          the Services page via ProjectsSection. */}
      <ProjectsSection />

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
