import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CodeEntry } from "../components/CodeEntry";
import { ProductView } from "../components/ProductView";
import { ApiError, checkoutCode, lookupCode } from "../lib/api";
import type { CodeLookup } from "../types";

// A code-only listing (backend/app/codes.py): /code/<CODE>, reached from the
// Shop page's "Have a code?" box or a link we sent. Unlike ProductDetailPage
// the item isn't in the static catalog — it only exists on the server, so
// it's fetched by code. /code with no code just shows the entry box.
export function CodePage() {
  const { code } = useParams();
  // Tagged with the code it answers, so "still loading" is just "no answer
  // for this code yet" — derived during render, no reset on code change.
  const [answer, setAnswer] = useState<{
    code: string;
    result: CodeLookup | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    lookupCode(code)
      .then((result) => !cancelled && setAnswer({ code, result, error: null }))
      .catch(
        (err) =>
          !cancelled &&
          setAnswer({
            code,
            result: null,
            error: err instanceof ApiError ? err.message : "Something went wrong — try again.",
          }),
      );
    return () => {
      cancelled = true;
    };
  }, [code]);

  const current = code && answer?.code === code ? answer : null;
  const loading = !!code && !current;
  const result = current?.result ?? null;
  const error = current?.error ?? null;

  if (result) {
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
          &gt; <span className="text-ink">Code {result.code}</span>
        </nav>
        <ProductView
          key={result.code}
          item={result.item}
          isSold={result.sold}
          startCheckout={() => checkoutCode(result.code)}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-ink">Enter your code</h1>
      <p className="mt-1 text-sm text-muted">
        Codes are 4 letters or numbers, from the message we sent you.
      </p>
      <div className="mt-6">
        {loading ? (
          <p className="text-sm text-muted">Looking up {code?.toUpperCase()}…</p>
        ) : (
          <CodeEntry key={code} error={error} />
        )}
      </div>
    </div>
  );
}
