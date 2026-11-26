import { AdminPageHeader, AdminEmptyState } from "../../components/AdminLayout";

// Inventory. The catalog itself lives in scripts/items.json, which is
// gitignored and written by scripts/add_item.py — so this page's eventual
// job is to do from a browser what that CLI does from a terminal, and to
// show sold state, which only the API knows (GET /api/sold-items).
export function AdminListPage() {
  return (
    <div>
      <AdminPageHeader
        title="List"
        description="Everything currently listed, what's sold, and what's left to list."
      />
      <AdminEmptyState title="Not built yet">
        This is where the catalog will be: add and edit items, upload photos, and mark
        things sold without opening a terminal. Today that's{" "}
        <code className="rounded bg-black/5 px-1 py-0.5">scripts/add_item.py</code> and{" "}
        <code className="rounded bg-black/5 px-1 py-0.5">scripts/sold_item.py</code>.
      </AdminEmptyState>
    </div>
  );
}
