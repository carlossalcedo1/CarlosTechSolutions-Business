import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getItemById } from "../data/items";
import { PlaceholderImage } from "../components/PlaceholderImage";
import { ConditionBadge } from "../components/ConditionBadge";
import { formatPrice } from "../lib/format";
import { CONTACT_PHONE } from "../lib/constants";
import { checkout, ApiError } from "../lib/api";
import { useSoldItemIds } from "../lib/useSoldItemIds";

export function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const item = id ? getItemById(id) : undefined;
  const soldIds = useSoldItemIds();
  const isSold = !!item && soldIds.has(item.id);
  const [buying, setBuying] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState(0);

  async function handleBuyNow() {
    if (!item || buying || isSold) return;
    setCheckoutError(null);
    setBuying(true);
    try {
      const { url } = await checkout(item.id);
      // Full navigation, not react-router: Stripe Checkout is a hosted page
      // on checkout.stripe.com, not a route in this app. .assign() (not
      // `.href = url`) sidesteps an oxlint immutability false-positive on
      // property assignment to the `window` global.
      window.location.assign(url);
    } catch (err) {
      setCheckoutError(
        err instanceof ApiError
          ? err.message
          : "Something went wrong starting checkout — try again, or use Local pickup below.",
      );
      setBuying(false);
    }
  }

  if (!item) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center">
        <p className="text-lg font-medium text-ink">We couldn&apos;t find that item.</p>
        <Link to="/shop" className="mt-2 inline-block text-brand hover:underline">
          Back to shop
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav className="mb-4 text-sm text-muted">
        <Link to="/" className="hover:text-brand">
          Home
        </Link>{" "}
        &gt;{" "}
        <Link to="/shop" className="hover:text-brand">
          Shop
        </Link>{" "}
        &gt;{" "}
        <Link to={`/shop?category=${item.category}`} className="hover:text-brand">
          {item.category}
        </Link>{" "}
        &gt; <span className="text-ink">{item.name}</span>
      </nav>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div>
          {item.images.length > 0 ? (
            <>
              <img
                src={item.images[activeImage]}
                alt={item.name}
                className="aspect-square w-full rounded bg-surface object-contain"
              />
              {item.images.length > 1 && (
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {item.images.map((src, i) => (
                    <button
                      key={src}
                      onClick={() => setActiveImage(i)}
                      aria-label={`View photo ${i + 1}`}
                      className={`overflow-hidden rounded border ${
                        i === activeImage ? "border-ink" : "border-hairline hover:border-muted"
                      }`}
                    >
                      <img
                        src={src}
                        alt=""
                        loading="lazy"
                        className="aspect-square w-full bg-surface object-contain"
                      />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <PlaceholderImage label="main image" className="aspect-square w-full rounded" />
          )}
        </div>

        <div>
          <h1 className="text-2xl font-semibold text-ink">{item.name}</h1>
          <p className="mt-1 text-2xl font-semibold text-ink">{formatPrice(item.priceCents)}</p>
          <div className="mt-2 flex items-center gap-2">
            <ConditionBadge condition={item.condition} linkToGuide />
            {isSold && (
              <span className="rounded-full bg-ink px-2.5 py-1 text-xs font-semibold text-white">
                Sold
              </span>
            )}
          </div>

          <div className="mt-4">
            <p className="text-sm font-medium text-ink">Details</p>
            <p className="mt-1 text-sm text-muted">Model: {item.model}</p>
            <p className="text-sm text-muted">Storage: {item.storage}</p>
            {/* Same number as the Notion inventory record — lets a return or
                warranty conversation reference the exact same item on both
                sides. */}
            <p className="text-sm text-muted">ID: {item.inventoryId}</p>
          </div>

          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted">
            {item.specs.map((spec) => (
              <li key={spec}>{spec}</li>
            ))}
          </ul>

          <p className="mt-4 text-sm text-ink">{item.description}</p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={handleBuyNow}
              disabled={buying || isSold}
              className="inline-flex items-center gap-2 rounded-full bg-ink px-8 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <rect x="4" y="10.5" width="16" height="10" rx="2" />
                <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
              </svg>
              {isSold ? "Sold" : buying ? "Redirecting to checkout…" : "Buy now"}
            </button>

            <button
              onClick={() =>
                navigate(`/contact?item=${encodeURIComponent(item.name)}&intent=pickup`)
              }
              className="rounded-full border border-ink px-7 py-3.5 text-sm font-medium text-ink transition hover:bg-ink hover:text-white"
            >
              Local pickup
            </button>

            <button
              onClick={() => navigate(`/contact?item=${encodeURIComponent(item.name)}`)}
              className="rounded-full border border-hairline px-7 py-3.5 text-sm font-medium text-ink transition hover:border-ink"
            >
              Questions?
            </button>
          </div>

          {/* Trust line under the primary action. The official Stripe mark can
              drop in here later — grab the SVG from stripe.com/newsroom/brand-assets
              and swap it for the text, keeping the lock icon. */}
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <rect x="4" y="10.5" width="16" height="10" rx="2" />
              <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
            </svg>
            Secure checkout powered by Stripe · Encrypted card information
          </p>

          {checkoutError && (
            <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {checkoutError}
            </p>
          )}

          {/* Buying details: how payment works, how pickup works, how to reach us */}
          <div className="mt-6 space-y-4 rounded-lg border border-hairline bg-surface p-5 text-sm">
            <div>
              <p className="font-medium text-ink">Paying by card</p>
              <p className="mt-1 leading-relaxed text-muted">
                Payments are handled by Stripe. Your card details go straight to them and never
                touch our servers. You&apos;ll get a receipt by email as soon as the payment
                clears.
              </p>
            </div>

            <div>
              <p className="font-medium text-ink">Local pickup in Gainesville, FL</p>
              <p className="mt-1 leading-relaxed text-muted">
                Skip shipping and collect it in person. Hit Local pickup above and we&apos;ll
                reply to set a time and place, and you&apos;re welcome to test the device before
                you pay. Pickup payments: Cash App, Venmo, Apple Pay, Zelle, or cash.
              </p>
            </div>

            <div>
              <p className="font-medium text-ink">Questions before you buy?</p>
              <p className="mt-1 leading-relaxed text-muted">
                Call or text{" "}
                <a href={`tel:${CONTACT_PHONE}`} className="font-medium text-ink hover:text-brand">
                  {CONTACT_PHONE}
                </a>{" "}
                — that&apos;s the fastest way to reach me.
              </p>
            </div>
          </div>

          <p className="mt-4 text-xs text-muted">
            Ships same day · Same or next-day local pickup ·{" "}
            <Link to="/returns" className="text-brand hover:underline">
              Return policy
            </Link>{" "}
            ·{" "}
            <Link to="/conditions" className="text-brand hover:underline">
              Condition guide
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
