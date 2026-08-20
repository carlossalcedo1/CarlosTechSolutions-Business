import { Link } from "react-router-dom";
import { items } from "../data/items";
import { CATEGORIES } from "../lib/constants";
import { ProductCard } from "../components/ProductCard";
import { PlaceholderImage } from "../components/PlaceholderImage";

const TRUST_BADGES = [
  "Factory unlocked",
  "Nationwide 3-4 day shipping",
  "New, used, refurb - low prices",
];

export function HomePage() {
  const recentlyListed = [...items]
    .sort((a, b) => (a.dateAdded < b.dateAdded ? 1 : -1))
    .slice(0, 4);

  return (
    <div>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 py-14 text-center">
        <h1 className="text-4xl font-semibold text-ink sm:text-5xl">Carlos Tech Solutions</h1>
        <p className="mt-3 text-lg text-muted">
          New, used, and recycled tech for an affordable audience
        </p>
        <p className="mt-1 text-sm text-muted">Every device is factory unlocked unless specified.</p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/shop"
            className="rounded bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark"
          >
            Shop inventory
          </Link>
          <Link
            to="/sell"
            className="rounded border border-ink px-5 py-2.5 text-sm font-medium text-ink hover:bg-ink hover:text-white"
          >
            Get a quote for your device
          </Link>
        </div>

        <PlaceholderImage label="image carousel" className="mt-8 h-56 w-full rounded" />
      </section>

      {/* Trust badges */}
      <section className="border-y border-hairline bg-surface">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-3 px-4 py-4 text-center text-sm font-medium text-ink sm:grid-cols-3">
          {TRUST_BADGES.map((badge) => (
            <span key={badge}>{badge}</span>
          ))}
        </div>
      </section>

      {/* Shop by category */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="mb-4 text-xl font-semibold text-ink">Shop by category</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {CATEGORIES.map((category) => (
            <Link
              key={category}
              to={`/shop?category=${encodeURIComponent(category)}`}
              className="rounded border border-hairline px-4 py-6 text-center font-medium text-ink hover:border-brand hover:text-brand"
            >
              {category}
            </Link>
          ))}
        </div>
      </section>

      {/* Recently listed */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="mb-4 text-xl font-semibold text-ink">Recently listed</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {recentlyListed.map((item) => (
            <ProductCard key={item.id} item={item} />
          ))}
        </div>
      </section>

      {/* About Carlos teaser */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <PlaceholderImage label="Carlos" className="h-24 w-24 shrink-0 rounded-full" />
          <div>
            <h2 className="text-xl font-semibold text-ink">About Carlos</h2>
            <p className="mt-1 text-muted">Short bio: who you are, why buyers can trust you.</p>
            <Link to="/about" className="mt-2 inline-block text-sm font-medium text-brand hover:underline">
              Read the full story &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* The Clean Way teaser */}
      <section className="border-t border-hairline bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h2 className="text-xl font-semibold text-ink">The Clean Way</h2>
          <p className="mt-2 max-w-2xl text-muted">
            Devices sourced from people who no longer need them, plus iCloud/MDM-locked units
            from businesses and schools that would otherwise be scrapped.
          </p>
          <Link to="/about#clean-way" className="mt-2 inline-block text-sm font-medium text-brand hover:underline">
            Learn about our process &rarr;
          </Link>
        </div>
      </section>

      {/* Sell your device CTA banner */}
      <section className="border-t border-hairline">
        <div className="mx-auto max-w-6xl px-4 py-10 text-center">
          <p className="text-lg font-semibold text-ink">Have a device to sell or trade in?</p>
          <Link
            to="/sell"
            className="mt-3 inline-block rounded border border-ink px-5 py-2.5 text-sm font-medium text-ink hover:bg-ink hover:text-white"
          >
            Get a quote
          </Link>
        </div>
      </section>
    </div>
  );
}
