import { AdminPageHeader, AdminEmptyState } from "../../components/AdminLayout";

// Code-only listings — the private ones reachable at /code/<CODE> for a
// sale arranged on eBay or Marketplace. Backed by backend/app/codes.py,
// which already has the whole model plus a CLI; this page is a face for it.
export function AdminCodesPage() {
  return (
    <div>
      <AdminPageHeader
        title="Codes"
        description="Private listings reachable only by a short code, for sales arranged elsewhere."
      />
      <AdminEmptyState title="Not built yet">
        The model and storage already exist in{" "}
        <code className="rounded bg-black/5 px-1 py-0.5">backend/app/codes.py</code> — one
        code, one item, one sale, nothing ever deleted. What's missing is a way to create
        and cancel them here instead of through{" "}
        <code className="rounded bg-black/5 px-1 py-0.5">scripts/gen_code.py</code>.
      </AdminEmptyState>
    </div>
  );
}
