import { Link, useSearchParams } from "react-router-dom";

// Stripe redirects here after a completed Checkout Session (see
// backend/app/payments.py's success_url). The real confirmation is the
// webhook — this page is just what the buyer sees in the tab that's still
// open; it doesn't call the API or trust session_id for anything.
export function CheckoutSuccessPage() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");

  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className="text-green-600"
          aria-hidden="true"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </div>
      <h1 className="mt-6 text-2xl font-semibold text-ink">Order confirmed</h1>
      <p className="mt-3 text-muted">
        Thanks for your order — a confirmation email is on its way. Stripe will also send its own
        payment receipt separately.
      </p>
      {sessionId && (
        <p className="mt-4 text-xs text-muted">
          Order reference: <span className="font-mono">{sessionId}</span>
        </p>
      )}
      <Link
        to="/shop"
        className="mt-8 inline-block rounded-full bg-ink px-7 py-3 text-sm font-medium text-white hover:opacity-90"
      >
        Continue shopping
      </Link>
    </div>
  );
}
