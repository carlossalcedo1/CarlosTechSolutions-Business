import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminPageHeader } from "../../../components/AdminLayout";
import { ProductCard } from "../../../components/ProductCard";
import { BackToList, ErrorNote, inputClass } from "../../../components/admin/ui";
import { CATEGORIES } from "../../../lib/constants";
import type { Category } from "../../../types";
import { useAdminInventory } from "./useAdminInventory";

// "Which listing?" — shown as the shop shows it, cards and all, so finding
// the one to change feels like browsing to buy it rather than reading a
// table. Tapping a card is the selection.

const COPY = {
  edit: {
    title: "Edit Listing",
    description: "Tap the listing you want to change.",
    empty: "There's nothing in the catalog to edit yet.",
  },
  delete: {
    title: "Delete Listing",
    description: "Tap the listing that sold. It moves to your sold log rather than being erased.",
    empty: "Nothing is for sale right now, so there's nothing to mark sold.",
  },
} as const;

export function PickListingPage({ mode }: { mode: "edit" | "delete" }) {
  const navigate = useNavigate();
  const { data, error, loading } = useAdminInventory();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | "All">("All");
  const copy = COPY[mode];

  const items = useMemo(() => {
    let list = data?.items ?? [];
    // Delete only offers what's still for sale — something that already
    // sold online can't sell again here, and logging it twice would
    // overstate what you sold.
    if (mode === "delete") list = list.filter((i) => i.remaining > 0);
    if (category !== "All") list = list.filter((i) => i.category === category);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((i) =>
        [i.name, i.inventoryId, i.specLine].some((s) => s.toLowerCase().includes(q)),
      );
    }
    // Newest first, like the shop.
    return [...list].sort((a, b) => (a.dateAdded < b.dateAdded ? 1 : -1));
  }, [data, mode, category, query]);

  const total = mode === "delete"
    ? (data?.items.filter((i) => i.remaining > 0).length ?? 0)
    : (data?.items.length ?? 0);

  return (
    <div>
      <BackToList />
      <AdminPageHeader title={copy.title} description={copy.description} />
      <div className="mt-4">
        <ErrorNote error={error} />
      </div>

      {loading && (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, n) => (
            <div key={n} className="h-64 animate-pulse rounded bg-black/5" />
          ))}
        </div>
      )}

      {data && total === 0 && <p className="mt-8 text-muted">{copy.empty}</p>}

      {data && total > 0 && (
        <>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or inventory ID"
              aria-label="Search listings"
              className={`${inputClass} mt-0`}
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category | "All")}
              aria-label="Category"
              className={`${inputClass} mt-0`}
            >
              <option value="All">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>

          {items.length === 0 ? (
            <p className="mt-8 text-muted">Nothing matches that.</p>
          ) : (
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {items.map((item) => (
                <ProductCard
                  key={item.id}
                  item={item}
                  sold={item.remaining === 0}
                  onSelect={() => navigate(`/admin/list/${mode}/${item.id}`)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
