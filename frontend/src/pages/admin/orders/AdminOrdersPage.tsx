import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AdminPageHeader } from "../../../components/AdminLayout";
import {
  AdminTable,
  RowButton,
  StatusPill,
  rowLinkClass,
  type Column,
} from "../../../components/admin/AdminTable";
import { ErrorNote } from "../../../components/admin/ui";
import { formatPrice } from "../../../lib/format";
import { getRecentOrders, markOrderShipped, ApiError, type AdminOrder } from "../../../lib/api";
import { orderDate, orderTime } from "./format";

// The five most recent orders, and the two things you do with an order once
// it's paid: send it, and give the buyer a way to follow it.
//
// The buttons change with the order. Unshipped: Mark as shipped and Add
// tracking. Shipped without a number: Add tracking. Shipped with one: View
// tracking, which is the USPS page itself rather than anything of ours.

const columns: Column<AdminOrder>[] = [
  {
    header: "Date",
    cell: (o) => (
      <span className="whitespace-nowrap">
        {orderDate(o.createdAt)}
        <span className="block text-xs text-muted sm:inline sm:pl-1.5">{orderTime(o.createdAt)}</span>
      </span>
    ),
  },
  {
    header: "Item",
    cell: (o) => (
      <span>
        {o.itemName ?? "—"}
        {o.code && <span className="block text-xs text-muted">Code {o.code}</span>}
      </span>
    ),
  },
  { header: "Customer", cell: (o) => o.customerName ?? "—" },
  {
    header: "Amount",
    className: "whitespace-nowrap",
    cell: (o) => (o.amountCents != null ? formatPrice(o.amountCents) : "—"),
  },
  {
    header: "Status",
    cell: (o) =>
      o.status === "shipped" ? (
        <StatusPill tone="green">Shipped</StatusPill>
      ) : (
        <StatusPill tone="orange">To ship</StatusPill>
      ),
  },
];

export function AdminOrdersPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof getRecentOrders>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await getRecentOrders());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load orders.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function ship(order: AdminOrder) {
    if (busyId) return;
    setBusyId(order.id);
    setError(null);
    try {
      const updated = await markOrderShipped(order.id);
      // Swap the row in place rather than reloading the list, so the table
      // doesn't jump while you're working down it.
      setData((d) => d && { ...d, orders: d.orders.map((o) => (o.id === updated.id ? updated : o)) });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't mark that shipped.");
    } finally {
      setBusyId(null);
    }
  }

  function actions(o: AdminOrder) {
    return (
      <>
        {o.status === "paid" && (
          <RowButton onClick={() => void ship(o)} disabled={busyId === o.id}>
            {busyId === o.id ? "Saving…" : "Mark as shipped"}
          </RowButton>
        )}
        {o.trackingUrl ? (
          <a href={o.trackingUrl} target="_blank" rel="noopener noreferrer" className={rowLinkClass}>
            View tracking
          </a>
        ) : (
          <Link to={`/admin/orders/${encodeURIComponent(o.id)}/tracking`} className={rowLinkClass}>
            Add tracking
          </Link>
        )}
      </>
    );
  }

  return (
    <div>
      <AdminPageHeader
        title="Orders"
        description="The five most recent paid orders. Orders show up here from the moment Stripe confirms payment."
      />

      <div className="mt-4">
        <ErrorNote error={error} />
      </div>

      {data === null && !error && <div className="mt-6 h-40 animate-pulse rounded-2xl bg-black/5" />}

      {data && (
        <div className="mt-6">
          {data.olderUnshipped > 0 && (
            // Only five fit, so an unshipped order that's sixth-newest would
            // otherwise just vanish from view. This is the line that stops
            // one going out late because nobody could see it.
            <p className="mb-4 rounded-xl border border-brand-bright bg-brand/5 px-4 py-3 text-sm text-ink">
              {data.olderUnshipped === 1
                ? "1 older order still hasn't shipped"
                : `${data.olderUnshipped} older orders still haven't shipped`}{" "}
              — it&apos;s further back than the five shown here. The sale-alert email has its
              address.
            </p>
          )}

          <AdminTable
            rows={data.orders}
            columns={columns}
            rowKey={(o) => o.id}
            actions={actions}
            empty={
              <>
                No orders yet. They&apos;ll appear here as soon as one is paid — anything from
                before this was switched on is in your Stripe dashboard.
              </>
            }
          />

          {data.total > data.orders.length && (
            <p className="mt-3 text-xs text-muted">
              Showing the {data.orders.length} newest of {data.total}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
