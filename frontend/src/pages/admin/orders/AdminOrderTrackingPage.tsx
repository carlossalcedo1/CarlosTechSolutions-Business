import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AdminPageHeader } from "../../../components/AdminLayout";
import { ErrorNote, Field, PillButton, PillLink, inputClass } from "../../../components/admin/ui";
import { formatPrice } from "../../../lib/format";
import {
  getOrder,
  setOrderTracking,
  ApiError,
  type AdminOrder,
  type ShippedEmailResult,
} from "../../../lib/api";
import { addressLines, orderDate } from "./format";

// Add a tracking number to one order. Its own page rather than a field in
// the table: you're usually doing this standing at the counter with the
// label in hand, and the shipping address is worth having in front of you
// while you do it.

export function AdminOrderTrackingPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<AdminOrder | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [number, setNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getOrder(id)
      .then((o) => {
        setOrder(o);
        setNumber(o.trackingNumber ?? "");
      })
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Couldn't load that order."));
  }, [id]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await setOrderTracking(id, number);
      // Back to the list, carrying what happened to the email. Every case
      // gets said out loud — the one you most need to hear is the email that
      // didn't go, since the buyer is waiting on it either way.
      navigate("/admin/orders", { state: { notice: emailNotice(saved.shippedEmail, saved.customerName) } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save that tracking number.");
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <Link to="/admin/orders" className="inline-block text-sm text-muted hover:text-ink">
        &larr; Back to Orders
      </Link>
      <AdminPageHeader
        title="Add tracking"
        description="Saving a tracking number marks the order shipped and emails the buyer the tracking link."
      />

      <div className="mt-4">
        <ErrorNote error={loadError} />
      </div>

      {order && (
        <>
          <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-2xl border border-hairline p-5 text-sm">
            <dt className="text-muted">Item</dt>
            <dd className="text-ink">{order.itemName ?? "—"}</dd>
            <dt className="text-muted">Customer</dt>
            <dd className="text-ink">{order.customerName ?? "—"}</dd>
            <dt className="text-muted">Paid</dt>
            <dd className="text-ink">
              {order.amountCents != null ? formatPrice(order.amountCents) : "—"} on{" "}
              {orderDate(order.createdAt)}
            </dd>
            <dt className="text-muted">Ship to</dt>
            <dd className="text-ink">
              {order.shippingName && <span className="block">{order.shippingName}</span>}
              {addressLines(order.shippingAddress).map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
              {!order.shippingName && addressLines(order.shippingAddress).length === 0 && "—"}
            </dd>
          </dl>

          <form onSubmit={save} className="mt-8 space-y-4">
            <Field
              label="USPS tracking number"
              htmlFor="tracking"
              hint="Paste it straight off the label — spaces are fine."
            >
              <input
                id="tracking"
                required
                autoFocus
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="9400 1118 9922 3397 8463 21"
                className={`${inputClass} font-mono tracking-wide`}
              />
            </Field>

            <ErrorNote error={error} />

            <div className="flex flex-wrap gap-2">
              <PillButton type="submit" disabled={saving || !number.trim()}>
                {saving ? "Saving…" : "Save tracking number"}
              </PillButton>
              <PillLink to="/admin/orders" tone="outline">
                Cancel
              </PillLink>
            </div>
          </form>
        </>
      )}
    </div>
  );
}

export type OrderNotice = { tone: "ok" | "warn"; text: string };

function emailNotice(result: ShippedEmailResult, customer: string | null): OrderNotice {
  const who = customer ?? "the buyer";
  switch (result) {
    case "sent":
      return { tone: "ok", text: `Tracking saved, and ${who} was emailed that it shipped.` };
    case "already-sent":
      return {
        tone: "warn",
        text: `Tracking saved. ${who} was already emailed with the earlier number, so they weren't emailed again — text them if the number changed.`,
      };
    case "no-email":
      return { tone: "warn", text: `Tracking saved, but this order has no email address, so ${who} wasn't notified.` };
    case "not-configured":
      return {
        tone: "warn",
        text: "Tracking saved, but email isn't set up on this server, so no shipping email went out.",
      };
    case "failed":
      return {
        tone: "warn",
        text: `Tracking saved, but the shipping email didn't send. Text ${who} the tracking number, or save it again to retry.`,
      };
  }
}
