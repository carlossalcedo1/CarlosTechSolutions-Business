import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { items } from "../data/items";
import { CATEGORIES, EBAY_PROFILE_URL, FACEBOOK_MARKETPLACE_URL } from "../lib/constants";
import { ProductCard } from "../components/ProductCard";
import { useSoldItemIds } from "../lib/useSoldItemIds";
import type { Category, Condition } from "../types";

const CONDITIONS: Condition[] = ["New", "A+ - Excellent", "B - Good", "C - Fair"];
// "Sold" is a display bucket, not a real Category — sold items live here
// instead of mixed into (or vanished from) the categories they were listed
// under, so a sale doesn't need a catalog rebuild to be reflected anywhere.
type Chip = Category | "All" | "Sold";
const CHIPS: Chip[] = ["All", ...CATEGORIES, "Sold"];

type SortOption = "newest" | "price-asc" | "price-desc";

export function ShopPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeChip = (searchParams.get("category") as Chip | null) ?? "All";
  const query = searchParams.get("q") ?? "";
  const soldIds = useSoldItemIds();

  const [brand, setBrand] = useState("All");
  const [condition, setCondition] = useState<Condition | "All">("All");
  const [sort, setSort] = useState<SortOption>("newest");

  const brands = useMemo(
    () => ["All", ...Array.from(new Set(items.map((item) => item.brand))).sort()],
    [],
  );

  function setCategory(chip: Chip) {
    const next = new URLSearchParams(searchParams);
    if (chip === "All") {
      next.delete("category");
    } else {
      next.set("category", chip);
    }
    setSearchParams(next);
  }

  const filtered = useMemo(() => {
    let result = items.filter((item) => {
      const isSold = soldIds.has(item.id);
      if (activeChip === "Sold") return isSold;
      if (isSold) return false;
      if (activeChip !== "All" && item.category !== activeChip) return false;
      if (brand !== "All" && item.brand !== brand) return false;
      if (condition !== "All" && item.condition !== condition) return false;
      if (query && !item.name.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });

    result = [...result].sort((a, b) => {
      if (sort === "price-asc") return a.priceCents - b.priceCents;
      if (sort === "price-desc") return b.priceCents - a.priceCents;
      return a.dateAdded < b.dateAdded ? 1 : -1;
    });

    return result;
  }, [activeChip, brand, condition, query, sort, soldIds]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-ink">Shop inventory</h1>
      {query && (
        <p className="mt-1 text-sm text-muted">
          Showing results for &ldquo;{query}&rdquo;
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {CHIPS.map((chip) => (
            <button
              key={chip}
              onClick={() => setCategory(chip)}
              className={`rounded-full border px-4 py-1.5 text-sm ${
                activeChip === chip
                  ? "border-ink bg-ink text-white"
                  : "border-hairline text-ink hover:border-ink"
              }`}
            >
              {chip}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <select
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="rounded border border-hairline px-2 py-1.5"
          >
            {brands.map((b) => (
              <option key={b} value={b}>
                {b === "All" ? "Brand: All" : b}
              </option>
            ))}
          </select>
          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value as Condition | "All")}
            className="rounded border border-hairline px-2 py-1.5"
          >
            <option value="All">Condition: All</option>
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="rounded border border-hairline px-2 py-1.5"
          >
            <option value="newest">Newest</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
          </select>
        </div>
      </div>

      <p className="mt-4 text-sm text-muted">
        {filtered.length} item{filtered.length === 1 ? "" : "s"}
      </p>

      {filtered.length > 0 ? (
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((item) => (
            <ProductCard key={item.id} item={item} sold={soldIds.has(item.id)} />
          ))}
        </div>
      ) : items.length === 0 ? (
        // Empty catalog (between inventory batches) vs. filters hiding
        // everything — different messages, since "clear a filter" won't help.
        <p className="mt-8 text-muted">New inventory is on the way — check back soon.</p>
      ) : (
        <p className="mt-8 text-muted">No items match those filters yet — try clearing one.</p>
      )}

      <p className="mt-10 border-t border-hairline pt-6 text-sm text-muted">
        *For the most up-to-date listings, also check out our{" "}
        <a
          href={FACEBOOK_MARKETPLACE_URL}
          target="_blank"
          rel="noreferrer"
          className="text-brand hover:underline"
        >
          Facebook
        </a>{" "}
        and{" "}
        <a
          href={EBAY_PROFILE_URL}
          target="_blank"
          rel="noreferrer"
          className="text-brand hover:underline"
        >
          eBay
        </a>{" "}
        pages.
      </p>
    </div>
  );
}
