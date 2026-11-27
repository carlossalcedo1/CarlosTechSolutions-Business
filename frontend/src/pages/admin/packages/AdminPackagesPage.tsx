import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AdminPageHeader } from "../../../components/AdminLayout";
import {
  AdminTable,
  RowButton,
  StatusPill,
  rowLinkClass,
  type Column,
} from "../../../components/admin/AdminTable";
import { ErrorNote, Field, PillButton, inputClass } from "../../../components/admin/ui";
import {
  addPackage,
  deletePackage,
  getPackages,
  retryPackage,
  ApiError,
  type Carrier,
  type PackagesResponse,
  type TrackedPackage,
} from "../../../lib/api";

// Everything on its way somewhere: orders you've shipped (added here on
// their own when you give an order a tracking number) and parts coming to
// you (added below). Shippo watches each number and reports every scan; a
// package turning "delivered" pushes to your phone.

// Each carrier's own tracking page, for the row's link.
const CARRIERS: { value: Carrier; name: string; trackUrl: string }[] = [
  {
    value: "usps",
    name: "USPS",
    trackUrl: "https://tools.usps.com/go/TrackConfirmAction?tLabels=",
  },
  { value: "ups", name: "UPS", trackUrl: "https://www.ups.com/track?tracknum=" },
  { value: "fedex", name: "FedEx", trackUrl: "https://www.fedex.com/fedextrack/?trknbr=" },
];

function carrierOf(p: TrackedPackage) {
  return CARRIERS.find((c) => c.value === (p.carrier ?? "usps")) ?? CARRIERS[0];
}

function statusPill(p: TrackedPackage) {
  if (!p.registeredAt) return <StatusPill tone="grey">Not tracked</StatusPill>;
  switch (p.status) {
    case "DELIVERED":
      return <StatusPill tone="green">Delivered</StatusPill>;
    case "TRANSIT":
      return (
        <StatusPill tone="orange">
          {p.substatus === "out_for_delivery" ? "Out for delivery" : "In transit"}
        </StatusPill>
      );
    case "PRE_TRANSIT":
      return <StatusPill tone="grey">Label created</StatusPill>;
    case "RETURNED":
      return <StatusPill tone="orange">Returned</StatusPill>;
    case "FAILURE":
      return <StatusPill tone="orange">Problem</StatusPill>;
    default:
      return <StatusPill tone="grey">No scans yet</StatusPill>;
  }
}

function when(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}

const columns: Column<TrackedPackage>[] = [
  {
    header: "Package",
    cell: (p) => (
      <span>
        {p.label}
        <span className="block text-xs text-muted">{p.kind === "order" ? "Order" : "Parts"}</span>
      </span>
    ),
  },
  {
    header: "Tracking",
    cell: (p) => (
      <span>
        <span className="font-mono text-xs break-all">{p.trackingNumber}</span>
        <span className="block text-xs text-muted">{carrierOf(p).name}</span>
      </span>
    ),
  },
  { header: "Status", cell: statusPill },
  {
    header: "Latest",
    cell: (p) =>
      p.registerError && !p.registeredAt ? (
        <span className="text-red-700">{p.registerError}</span>
      ) : (
        <span className="text-sm">
          {p.statusDetails ?? "—"}
          {(p.location || p.statusDate) && (
            <span className="block text-xs text-muted">
              {[p.location, when(p.statusDate)].filter(Boolean).join(" · ")}
            </span>
          )}
        </span>
      ),
  },
];

export function AdminPackagesPage() {
  const [data, setData] = useState<PackagesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [number, setNumber] = useState("");
  const [label, setLabel] = useState("");
  const [carrier, setCarrier] = useState<Carrier>("usps");
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await getPackages());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load packages.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (adding) return;
    setAdding(true);
    setError(null);
    try {
      await addPackage(number, label, carrier);
      setNumber("");
      setLabel("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't add that package.");
    } finally {
      setAdding(false);
    }
  }

  async function act(p: TrackedPackage, action: "retry" | "remove") {
    if (busyId) return;
    if (
      action === "remove" &&
      !window.confirm(
        `Stop tracking "${p.label}"? This doesn't give back this month's registration.`,
      )
    )
      return;
    setBusyId(p.id);
    setError(null);
    try {
      if (action === "retry") await retryPackage(p.id);
      else await deletePackage(p.id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That didn't work — try again.");
    } finally {
      setBusyId(null);
    }
  }

  function actions(p: TrackedPackage) {
    return (
      <>
        {!p.registeredAt && (
          <RowButton onClick={() => void act(p, "retry")} disabled={busyId === p.id}>
            Retry
          </RowButton>
        )}
        <a
          href={carrierOf(p).trackUrl + encodeURIComponent(p.trackingNumber)}
          target="_blank"
          rel="noopener noreferrer"
          className={rowLinkClass}
        >
          {carrierOf(p).name}
        </a>
        <RowButton tone="outline" onClick={() => void act(p, "remove")} disabled={busyId === p.id}>
          Remove
        </RowButton>
      </>
    );
  }

  const full = data ? data.usedThisMonth >= data.monthlyLimit : false;

  return (
    <div>
      <AdminPageHeader
        title="Packages"
        description="Orders you've shipped and parts on their way to you. You'll get a push when one is delivered."
      />

      {data && !data.configured && (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Tracking isn&apos;t set up on this server yet — it needs SHIPPO_API_TOKEN and
          SHIPPO_WEBHOOK_TOKEN. Packages can be added, but won&apos;t get a status until then.
        </p>
      )}

      <form
        onSubmit={add}
        className="mt-6 grid gap-4 rounded-2xl border border-hairline p-5 sm:grid-cols-[1fr_auto_1fr_auto] sm:items-end"
      >
        <Field label="What is it?" htmlFor="pkg-label">
          <input
            id="pkg-label"
            required
            maxLength={80}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Carrier" htmlFor="pkg-carrier">
          <select
            id="pkg-carrier"
            value={carrier}
            onChange={(e) => setCarrier(e.target.value as Carrier)}
            className={inputClass}
          >
            {CARRIERS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tracking number" htmlFor="pkg-number">
          <input
            id="pkg-number"
            required
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            className={`${inputClass} font-mono`}
          />
        </Field>
        <PillButton type="submit" disabled={adding || !number.trim() || !label.trim()}>
          {adding ? "Adding…" : "Track package"}
        </PillButton>
      </form>

      {data && (
        <p className={`mt-3 text-xs ${full ? "font-medium text-red-700" : "text-muted"}`}>
          {data.usedThisMonth} of {data.monthlyLimit} free tracking registrations used this month
          {full && " — new packages won't be tracked until next month"}.
        </p>
      )}

      <div className="mt-4">
        <ErrorNote error={error} />
      </div>

      {data === null && !error && (
        <div className="mt-6 h-40 animate-pulse rounded-2xl bg-black/5" />
      )}

      {data && (
        <div className="mt-6">
          <AdminTable
            rows={data.packages}
            columns={columns}
            rowKey={(p) => p.id}
            actions={actions}
            empty={
              <>
                Nothing tracked yet. Add parts above; orders appear here on their own when you give
                one a tracking number.
              </>
            }
          />
        </div>
      )}
    </div>
  );
}
