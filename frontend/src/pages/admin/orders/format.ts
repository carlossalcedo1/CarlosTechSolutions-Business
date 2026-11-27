import type { ShippingAddress } from "../../../lib/api";

/** "Nov 26, 2026" — the date column. */
export function orderDate(unixSeconds: number) {
  return new Date(unixSeconds * 1000).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** "2:14 PM" — under the date, small. Whether it's today's or yesterday's
 *  matters when the promise is same-day shipping. */
export function orderTime(unixSeconds: number) {
  return new Date(unixSeconds * 1000).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function addressLines(a: ShippingAddress | null): string[] {
  if (!a) return [];
  const cityLine = [a.city, [a.state, a.postal_code].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  return [a.line1, a.line2, cityLine].filter((l): l is string => Boolean(l && l.trim()));
}
