import { Link } from "react-router-dom";
import type { Condition } from "../types";
import { CONDITION_ANCHORS } from "../components/ConditionBadge";

interface ConditionInfo {
  condition: Condition;
  badgeClass: string;
  description: string;
}

const CONDITIONS: ConditionInfo[] = [
  {
    condition: "New",
    badgeClass: "bg-green-100 text-green-800",
    description: "Brand new and unused, in original packaging.",
  },
  {
    condition: "A+ - Excellent",
    badgeClass: "bg-blue-100 text-blue-800",
    description: "Little to no scratches, no cracks. Also referred to as 'Mint' condition",
  },
  {
    condition: "B - Good",
    badgeClass: "bg-amber-100 text-amber-800",
    description:
      "Normal everyday wear. May contain small scratches. Refer to listing pictures.",
  },
  {
    condition: "C - Fair",
    badgeClass: "bg-gray-200 text-gray-700",
    description:
      "Visible to heavy signs of use (scratches, dings, discoloration) and may contain cracks. View the description for more information on any defects.",
  },
];

export function ConditionsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <nav className="mb-4 text-sm text-muted">
        <Link to="/" className="hover:text-brand">
          Home
        </Link>{" "}
        &gt; <span className="text-ink">Condition guide</span>
      </nav>

      <h1 className="text-2xl font-semibold text-ink">What our condition grades mean</h1>
      <p className="mt-2 text-sm text-muted">
        Every listing is graded using one of the levels below. Photos in each listing show the
        actual device, so use the grade alongside the pictures when deciding.
      </p>

      <div className="mt-8 space-y-4">
        {CONDITIONS.map(({ condition, badgeClass, description }) => (
          <section
            key={condition}
            id={CONDITION_ANCHORS[condition]}
            aria-labelledby={`${CONDITION_ANCHORS[condition]}-heading`}
            className="scroll-mt-24 rounded-lg border border-hairline p-5"
          >
            <span
              id={`${CONDITION_ANCHORS[condition]}-heading`}
              className={`inline-block rounded px-2 py-1 text-sm font-medium ${badgeClass}`}
            >
              {condition}
            </span>
            <p className="mt-3 leading-relaxed text-ink">{description}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
