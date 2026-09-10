import { useEffect, useState } from "react";
import { getSoldItemIds } from "./api";

/**
 * Which catalog items are sold, per the live backend — the catalog itself
 * is a static build (see LAUNCH_CHECKLIST.md), so this is the one thing it
 * asks the API for at runtime. Fails open on purpose: if the request fails,
 * items just show as available rather than the page breaking — worst case
 * someone hits Buy Now on an already-sold item, which /api/checkout
 * refuses server-side anyway.
 */
export function useSoldItemIds(): Set<string> {
  const [sold, setSold] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    getSoldItemIds()
      .then((ids) => {
        if (!cancelled) setSold(new Set(ids));
      })
      .catch(() => {
        // Network hiccup or the API isn't up — see the docstring above.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return sold;
}
