import { Link } from "react-router-dom";
import type { Item } from "../types";
import { PlaceholderImage } from "./PlaceholderImage";
import { ConditionBadge } from "./ConditionBadge";

export function ProductCard({ item }: { item: Item }) {
  return (
    <Link
      to={`/product/${item.id}`}
      className="flex flex-col overflow-hidden rounded border border-hairline transition hover:shadow-md"
    >
      <PlaceholderImage className="h-40 w-full" />
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="font-medium text-ink">{item.name}</p>
        <p className="text-sm text-muted">{item.specLine}</p>
        <div className="mt-auto flex items-center justify-between pt-2">
          <ConditionBadge condition={item.condition} />
          <span className="font-semibold text-ink">${item.price}</span>
        </div>
      </div>
    </Link>
  );
}
