import { Link } from "react-router-dom";
import type { Item } from "../types";
import { PlaceholderImage } from "./PlaceholderImage";
import { ConditionBadge } from "./ConditionBadge";
import { formatPrice } from "../lib/format";

const cardClass = (sold: boolean) =>
  `relative flex flex-col overflow-hidden rounded border border-hairline text-left transition hover:shadow-md ${
    sold ? "opacity-70" : ""
  }`;

/**
 * The shop's product card.
 *
 * With `onSelect` it renders as a button instead of a link to the product
 * page — that's the admin panel's picker for "which listing do you want to
 * edit or remove?". Same component rather than a lookalike, so picking a
 * listing looks exactly like browsing to buy one, and the two can't drift.
 */
export function ProductCard({
  item,
  sold = false,
  onSelect,
}: {
  item: Item;
  sold?: boolean;
  onSelect?: (item: Item) => void;
}) {
  const body = (
    <>
      {sold && (
        <span className="absolute left-2 top-2 z-10 rounded-full bg-ink px-2.5 py-1 text-xs font-semibold text-white">
          Sold
        </span>
      )}
      {item.images.length > 0 ? (
        <img
          src={item.images[0]}
          alt={item.name}
          loading="lazy"
          className="h-40 w-full bg-surface object-contain"
        />
      ) : (
        <PlaceholderImage className="h-40 w-full" />
      )}
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="font-medium text-ink">{item.name}</p>
        <p className="text-sm text-muted">{item.specLine}</p>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-1 pt-2">
          <ConditionBadge condition={item.condition} />
          <span className="shrink-0 font-semibold text-ink">
            {formatPrice(item.priceCents)}
          </span>
        </div>
      </div>
    </>
  );

  if (onSelect) {
    return (
      <button type="button" onClick={() => onSelect(item)} className={cardClass(sold)}>
        {body}
      </button>
    );
  }

  return (
    <Link to={`/product/${item.id}`} className={cardClass(sold)}>
      {body}
    </Link>
  );
}
