import { useCallback, useEffect, useRef, useState } from "react";
import { AdminPageHeader } from "../../components/AdminLayout";
import {
  AdminTable,
  RowButton,
  StatusPill,
  type Column,
} from "../../components/admin/AdminTable";
import { ErrorNote, PillLink } from "../../components/admin/ui";
import { copyText } from "../../lib/clipboard";
import { formatPrice } from "../../lib/format";
import { cancelCode, getCodes, ApiError, type AdminCode } from "../../lib/api";
import { codeLink } from "./codes/NewCodePage";

// Every code you've made, split in two: the ones that still open something,
// and the ones that don't. Same table as Orders, so the two tabs read alike.
//
// Codes live on the API's data volume, not in the repo, so — unlike List —
// all of this works on the live server, from a phone, with no deploy.

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

const INACTIVE_LABEL: Record<Exclude<AdminCode["status"], "active">, string> = {
  sold: "Sold",
  cancelled: "Cancelled",
  expired: "Expired",
};

const baseColumns: Column<AdminCode>[] = [
  {
    header: "Code",
    cell: (c) => <span className="font-mono text-base font-semibold tracking-widest">{c.code}</span>,
  },
  { header: "Item", cell: (c) => c.item.name },
  { header: "Price", className: "whitespace-nowrap", cell: (c) => formatPrice(c.item.priceCents) },
];

const activeColumns: Column<AdminCode>[] = [
  ...baseColumns,
  { header: "Expires", className: "whitespace-nowrap", cell: (c) => shortDate(c.expiresAt) },
  { header: "Status", cell: () => <StatusPill tone="green">Active</StatusPill> },
];

const inactiveColumns: Column<AdminCode>[] = [
  ...baseColumns,
  {
    header: "When",
    className: "whitespace-nowrap",
    cell: (c) => shortDate(c.soldAt ?? c.expiresAt),
  },
  {
    header: "Status",
    cell: (c) => (
      <StatusPill tone={c.status === "sold" ? "orange" : "grey"}>
        {c.status === "active" ? "Active" : INACTIVE_LABEL[c.status]}
      </StatusPill>
    ),
  },
];

export function AdminCodesPage() {
  const [codes, setCodes] = useState<AdminCode[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  // Cancelling is permanent — a cancelled code never opens again — so it
  // takes two taps: the first arms it, the second does it.
  const [armed, setArmed] = useState<string | null>(null);
  const disarm = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const load = useCallback(async () => {
    try {
      setCodes((await getCodes()).codes);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load codes.");
    }
  }, []);

  useEffect(() => {
    void load();
    return () => clearTimeout(disarm.current);
  }, [load]);

  async function copyLink(code: string) {
    if (await copyText(codeLink(code))) {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode((c) => (c === code ? null : c)), 2000);
    } else {
      setError("Couldn't copy — your browser blocked the clipboard.");
    }
  }

  async function cancel(code: string) {
    if (armed !== code) {
      setArmed(code);
      clearTimeout(disarm.current);
      disarm.current = setTimeout(() => setArmed(null), 4000);
      return;
    }
    setArmed(null);
    try {
      const updated = await cancelCode(code);
      setCodes((list) => list && list.map((c) => (c.code === updated.code ? updated : c)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't cancel that code.");
      void load(); // it may have sold in the meantime — show what's true
    }
  }

  const active = codes?.filter((c) => c.active) ?? [];
  const inactive = codes?.filter((c) => !c.active) ?? [];

  return (
    <div>
      <AdminPageHeader
        title="Codes"
        description="Private listings reachable only by a short code, for sales arranged elsewhere. Live the moment they're made — no deploy."
      />

      <div className="mt-6">
        <PillLink to="/admin/codes/new">Generate Code</PillLink>
      </div>

      <div className="mt-4">
        <ErrorNote error={error} />
      </div>

      {codes === null && !error && <div className="mt-6 h-40 animate-pulse rounded-2xl bg-black/5" />}

      {codes && (
        <>
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-ink uppercase">
              Active <span className="font-normal text-muted">({active.length})</span>
            </h2>
            <AdminTable
              rows={active}
              columns={activeColumns}
              rowKey={(c) => c.code}
              empty="No active codes. Generate one when a buyer elsewhere wants to pay through the site."
              actions={(c) => (
                <>
                  <RowButton tone="outline" onClick={() => void copyLink(c.code)}>
                    {copiedCode === c.code ? "Copied" : "Copy link"}
                  </RowButton>
                  <RowButton
                    tone={armed === c.code ? "black" : "outline"}
                    onClick={() => void cancel(c.code)}
                    className={armed === c.code ? "" : "text-red-700"}
                  >
                    {armed === c.code ? "Tap again to cancel" : "Cancel"}
                  </RowButton>
                </>
              )}
            />
          </section>

          <section className="mt-10">
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-ink uppercase">
              Inactive <span className="font-normal text-muted">({inactive.length})</span>
            </h2>
            <AdminTable
              rows={inactive}
              columns={inactiveColumns}
              rowKey={(c) => c.code}
              empty="None yet. Codes land here once they sell, expire or are cancelled — every one is kept."
            />
          </section>
        </>
      )}
    </div>
  );
}
