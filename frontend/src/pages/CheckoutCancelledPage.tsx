import { Link } from "react-router-dom";

// Stripe redirects here if the buyer backs out of Checkout (see
// backend/app/payments.py's cancel_url). Nothing was charged — the item is
// still available, so this just points them back rather than treating it
// as an error.
export function CheckoutCancelledPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <h1 className="text-2xl font-semibold text-ink">Checkout cancelled</h1>
      <p className="mt-3 text-muted">
        No charge was made. The item&apos;s still available whenever you&apos;re ready.
      </p>
      <Link
        to="/shop"
        className="mt-8 inline-block rounded-full bg-ink px-7 py-3 text-sm font-medium text-white hover:opacity-90"
      >
        Back to shop
      </Link>
    </div>
  );
}
