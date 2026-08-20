import type { Condition } from "../types";

const styles: Record<Condition, string> = {
  New: "bg-green-100 text-green-800",
  Excellent: "bg-blue-100 text-blue-800",
  Good: "bg-amber-100 text-amber-800",
  Fair: "bg-gray-200 text-gray-700",
};

export function ConditionBadge({ condition }: { condition: Condition }) {
  return (
    <span className={`inline-block rounded px-2 py-1 text-xs font-medium ${styles[condition]}`}>
      {condition}
    </span>
  );
}
