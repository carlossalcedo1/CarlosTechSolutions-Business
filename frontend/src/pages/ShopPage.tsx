import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { items } from "../data/items";
import { CATEGORIES } from "../lib/constants";
import { ProductCard } from "../components/ProductCard";
import type { Category, Condition } from "../types";

const CONDITIONS: Condition[] = ["New", "Excellent", "Good", "Fair"];
const CHIPS: Array<Category | "All"> = ["All", ...CATEGORIES];

type SortOption = "newest" | "price-asc" | "price-desc";

export function ShopPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeCategory = (searchParams.get("category") as Category | null) ?? "All";
  const query = searchParams.get("q") ?? "";

  const [brand, setBrand] = useState("All");
  const [condition, setCondition] = useState<Condition | "All">("All");
  const [sort, setSort] = useState<SortOption>("newest");

  const brands = useMemo(
    () => ["All", ...Array.from(new Set(items.map((item) => item.brand))).sort()],
    [],
  );

  function setCategory(category: Category | "All") {
    const next = new URLSearchParams(searchParams);
    if (category === "All") {
      next.delete("category");
    } else {
      next.set("category", category);
    }
    setSearchParams(next);
  }

  const filtered = useMemo(() => {
    let result = items.filter((item) => {
      if (activeCategory !== "All" && item.category !== activeCategory) return false;
      if (brand !== "All" && item.brand !== brand) return false;
      if (condition !== "All" && item.condition !== condition) return false;
      if (query && !item.name.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });

    result = [...result].sort((a, b) => {
      if (sort === "price-asc") return a.price - b.price;
      if (sort === "price-desc") return b.price - a.price;
      return a.dateAdded < b.dateAdded ? 1 : -1;
    });

    return result;
  }, [activeCategory, brand, condition, query, sort]);

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
              className={`rounded border px-3 py-1.5 text-sm ${
                activeCategory === chip
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
            <ProductCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <p className="mt-8 text-muted">No items match those filters yet — try clearing one.</p>
      )}
    </div>
  );
}
