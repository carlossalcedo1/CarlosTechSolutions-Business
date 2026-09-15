import { Link } from "react-router-dom";
import type { Condition } from "../types";

const styles: Record<Condition, string> = {
  New: "bg-green-100 text-green-800",
  "A+ - Excellent": "bg-blue-100 text-blue-800",
  "B - Good": "bg-amber-100 text-amber-800",
  "C - Fair": "bg-gray-200 text-gray-700",
};

// Section ids on the /conditions page, so a badge can deep-link straight to
// its own grade instead of just the top of the guide.
export const CONDITION_ANCHORS: Record<Condition, string> = {
  New: "new",
  "A+ - Excellent": "a-plus",
  "B - Good": "b",
  "C - Fair": "c",
};

export function ConditionBadge({
  condition,
  linkToGuide = false,
}: {
  condition: Condition;
  /** Makes the badge a link to its grade's explanation on /conditions. */
  linkToGuide?: boolean;
}) {
  const className = `inline-block rounded px-2 py-1 text-xs font-medium ${styles[condition]}`;

  if (linkToGuide) {
    return (
      <Link
        to={`/conditions#${CONDITION_ANCHORS[condition]}`}
        className={`${className} transition hover:opacity-80 hover:underline`}
        aria-label={`${condition} — see what this condition grade means`}
      >
        {condition}
      </Link>
    );
  }

  return <span className={className}>{condition}</span>;
}
