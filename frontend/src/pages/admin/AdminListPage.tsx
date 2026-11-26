import { AdminPageHeader } from "../../components/AdminLayout";
import { DeployPanel } from "../../components/admin/DeployPanel";
import { ErrorNote, PillLink } from "../../components/admin/ui";
import type { Category } from "../../types";
import { useAdminInventory } from "./list/useAdminInventory";

// The List tab's front page: how much is listed, the three things you can
// do about it, and whether any of it is live yet.
//
// Each action is its own route (/admin/list/create, /edit, /delete) rather
// than a mode inside this page, so the phone's back button steps back
// through a flow the way you'd expect instead of leaving the panel.

const WORDS: Record<Category, [string, string]> = {
  Phones: ["phone", "phones"],
  Tablets: ["tablet", "tablets"],
  Computers: ["computer", "computers"],
  Accessories: ["accessory", "accessories"],
};

function phrase(category: Category, n: number) {
  const [one, many] = WORDS[category];
  return `${n} ${n === 1 ? one : many}`;
}

function joinWithAnd(parts: string[]) {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** "You have 7 items listed: 3 phones, 2 tablets and 2 computers."
 *  Phones, tablets and computers always appear, even at zero, because
 *  they're what the shop is; accessories only once there are some. */
function CountsParagraph({ counts }: { counts: Record<Category, number> }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const shown: Category[] = ["Phones", "Tablets", "Computers"];
  if (counts.Accessories > 0) shown.push("Accessories");
  const parts = shown.map((c) => phrase(c, counts[c]));

  return (
    <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink">
      {total === 0 ? (
        <>Nothing is listed right now. Create a listing to get started.</>
      ) : (
        <>
          You have <span className="font-semibold">{total}</span>{" "}
          {total === 1 ? "item" : "items"} listed: {joinWithAnd(parts)}.
        </>
      )}
    </p>
  );
}

export function AdminListPage() {
  const { data, error, loading } = useAdminInventory();
  const hasItems = (data?.items.length ?? 0) > 0;
  const canEdit = data?.repoAvailable ?? false;

  return (
    <div>
      <AdminPageHeader
        title="List"
        description="What's listed, and the three things you can do about it. Changes save to the catalog straight away and reach the shop when you deploy."
      />

      <div className="mt-4">
        <ErrorNote error={error} />
      </div>

      {loading && <div className="mt-6 h-7 w-2/3 animate-pulse rounded bg-black/5" />}

      {data && (
        <>
          {!data.repoAvailable && (
            <p className="mt-6 rounded-xl border border-hairline bg-surface px-4 py-3 text-sm text-muted">
              Listings can&apos;t be changed from this server — it&apos;s the deployed
              container, which has no copy of the repo to edit. Use the panel on the machine
              you normally run <code>add_item.py</code> on.
            </p>
          )}

          <CountsParagraph counts={data.counts} />

          {/* Wraps to stacked full-width pills on a phone rather than three
              squeezed side by side. */}
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {canEdit ? (
              <>
                <PillLink to="/admin/list/create">Create Listing</PillLink>
                {hasItems && <PillLink to="/admin/list/edit">Edit Listing</PillLink>}
                {hasItems && <PillLink to="/admin/list/delete">Delete Listing</PillLink>}
              </>
            ) : (
              <p className="text-sm text-muted">Create, Edit and Delete are switched off here.</p>
            )}
          </div>

          <div className="mt-10">
            <DeployPanel />
          </div>
        </>
      )}
    </div>
  );
}
