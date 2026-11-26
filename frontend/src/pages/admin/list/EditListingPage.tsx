import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { AdminPageHeader } from "../../../components/AdminLayout";
import { DeployPanel } from "../../../components/admin/DeployPanel";
import {
  BackToList,
  ErrorNote,
  Field,
  PillButton,
  PillLink,
  inputClass,
} from "../../../components/admin/ui";
import { ProductCard } from "../../../components/ProductCard";
import { CATEGORIES, CONDITIONS } from "../../../lib/constants";
import { formatPrice } from "../../../lib/format";
import { editListing, ApiError, type AdminItem, type EditableField } from "../../../lib/api";
import { useAdminInventory } from "./useAdminInventory";

// Pick what to change, type the new value, confirm, done. One field at a
// time on purpose: on a phone, a full edit form for a listing that only
// needs a new price is a lot of scrolling past things you didn't mean to
// touch.

type Kind = "text" | "decimal" | "number" | "textarea" | "select" | "toggle";

type FieldSpec = {
  label: string;
  kind: Kind;
  options?: readonly string[];
  /** The listing's current value, as the input should start out. */
  current: (item: AdminItem) => string;
  /** How a value reads in the "from … to …" confirmation. */
  show: (value: string) => ReactNode;
  hint?: string;
};

const plain = (v: string) => v || "—";

const FIELDS: Record<EditableField, FieldSpec> = {
  price: {
    label: "Price",
    kind: "decimal",
    current: (i) => (i.priceCents / 100).toFixed(2).replace(/\.00$/, ""),
    show: (v) => {
      const n = Number(v.replace(/[$,]/g, ""));
      return Number.isFinite(n) ? formatPrice(Math.round(n * 100)) : v;
    },
  },
  quantity: {
    label: "Quantity",
    kind: "number",
    current: (i) => String(i.quantity),
    show: plain,
  },
  condition: {
    label: "Condition",
    kind: "select",
    options: CONDITIONS,
    current: (i) => i.condition,
    show: plain,
  },
  category: {
    label: "Category",
    kind: "select",
    options: CATEGORIES,
    current: (i) => i.category,
    show: plain,
  },
  brand: {
    label: "Brand",
    kind: "text",
    current: (i) => i.brand,
    show: plain,
    hint: "The title follows: it's always Brand Model Storage. The link stays the same.",
  },
  model: {
    label: "Model",
    kind: "text",
    current: (i) => i.model,
    show: plain,
    hint: "The title follows: it's always Brand Model Storage. The link stays the same.",
  },
  storage: {
    label: "Storage",
    kind: "text",
    current: (i) => i.storage,
    show: plain,
    hint: "The title follows: it's always Brand Model Storage. The link stays the same.",
  },
  inventoryId: {
    label: "Inventory ID",
    kind: "text",
    current: (i) => i.inventoryId,
    show: plain,
  },
  specLine: {
    label: "Short spec line",
    kind: "text",
    current: (i) => i.specLine,
    show: plain,
  },
  specs: {
    label: "Spec bullets",
    kind: "textarea",
    current: (i) => i.specs.join("\n"),
    show: (v) => (
      <ul className="list-disc pl-5">
        {v
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
          .map((l, n) => (
            <li key={n}>{l}</li>
          ))}
      </ul>
    ),
    hint: "One per line.",
  },
  featured: {
    label: "Featured on homepage",
    kind: "toggle",
    current: (i) => (i.featured ? "true" : "false"),
    show: (v) => (v === "true" ? "Yes" : "No"),
  },
};

const ORDER: EditableField[] = [
  "price",
  "quantity",
  "condition",
  "specLine",
  "specs",
  "category",
  "brand",
  "model",
  "storage",
  "inventoryId",
  "featured",
];

export function EditListingPage() {
  const { id = "" } = useParams();
  const { data, error: loadError, loading } = useAdminInventory();
  const item = data?.items.find((i) => i.id === id);

  const [field, setField] = useState<EditableField>("price");
  const [value, setValue] = useState("");
  const [step, setStep] = useState<"choose" | "review" | "done">("choose");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updated, setUpdated] = useState<AdminItem | null>(null);

  const spec = FIELDS[field];
  const base = updated ?? item;

  // Prefill with the current value whenever the field (or listing) changes,
  // so the input shows what you're changing rather than a blank.
  useEffect(() => {
    if (base) setValue(spec.current(base));
  }, [field, base, spec]);

  if (loading) return <div className="h-40 animate-pulse rounded bg-black/5" />;
  if (loadError) return <ErrorNote error={loadError} />;
  if (!item || !base) {
    return (
      <div>
        <BackToList />
        <p className="mt-6 text-muted">That listing isn&apos;t in the catalog anymore.</p>
        <PillLink to="/admin/list/edit" tone="outline" className="mt-4">
          Pick another
        </PillLink>
      </div>
    );
  }

  const unchanged = value.trim() === spec.current(base).trim();

  function review(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setStep("review");
  }

  async function confirm() {
    if (saving || !base) return;
    setSaving(true);
    setError(null);
    try {
      const sent = field === "featured" ? value === "true" : value;
      const { after } = await editListing(base.id, field, sent);
      setUpdated({ ...after, remaining: base.remaining });
      setStep("done");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save that change.");
      setStep("choose");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <Link to="/admin/list/edit" className="inline-block text-sm text-muted hover:text-ink">
        &larr; Pick a different listing
      </Link>
      <AdminPageHeader
        title={step === "done" ? "Saved" : "Edit Listing"}
        description={
          step === "done"
            ? "Saved to the catalog. It reaches the shop when you deploy."
            : base.name
        }
      />

      <div className="mt-6 max-w-[14rem]">
        <ProductCard item={base} sold={base.remaining === 0} />
      </div>

      {step === "choose" && (
        <form onSubmit={review} className="mt-8 space-y-5">
          <Field label="What do you want to change?" htmlFor="field">
            <select
              id="field"
              value={field}
              onChange={(e) => setField(e.target.value as EditableField)}
              className={inputClass}
            >
              {ORDER.map((f) => (
                <option key={f} value={f}>
                  {FIELDS[f].label}
                </option>
              ))}
            </select>
          </Field>

          <Field label={`New ${spec.label.toLowerCase()}`} htmlFor="value" hint={spec.hint}>
            <ValueInput spec={spec} value={value} onChange={setValue} />
          </Field>

          <ErrorNote error={error} />

          <div className="flex flex-wrap gap-2">
            <PillButton type="submit" disabled={unchanged}>
              Review change
            </PillButton>
            <PillLink to="/admin/list" tone="outline">
              Cancel
            </PillLink>
          </div>
          {unchanged && (
            <p className="text-xs text-muted">That&apos;s what it already is.</p>
          )}
        </form>
      )}

      {step === "review" && (
        <section className="mt-8 rounded-2xl border border-hairline p-5">
          <p className="font-medium text-ink">Change {spec.label.toLowerCase()}?</p>
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted">From</dt>
            <dd className="text-ink">{spec.show(spec.current(base))}</dd>
            <dt className="text-muted">To</dt>
            <dd className="font-medium text-ink">{spec.show(value)}</dd>
          </dl>
          <div className="mt-5 flex flex-wrap gap-2">
            <PillButton onClick={() => void confirm()} disabled={saving}>
              {saving ? "Saving…" : "Confirm"}
            </PillButton>
            <PillButton tone="outline" onClick={() => setStep("choose")} disabled={saving}>
              Back
            </PillButton>
          </div>
        </section>
      )}

      {step === "done" && (
        <>
          <div className="mt-8">
            <DeployPanel compact />
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <PillButton tone="outline" onClick={() => setStep("choose")}>
              Change something else
            </PillButton>
            <PillLink to="/admin/list/edit" tone="outline">
              Edit another listing
            </PillLink>
            <PillLink to="/admin/list" tone="outline">
              Back to List
            </PillLink>
          </div>
        </>
      )}

      {step !== "done" && (
        <div className="mt-10">
          <BackToList />
        </div>
      )}
    </div>
  );
}

function ValueInput({
  spec,
  value,
  onChange,
}: {
  spec: FieldSpec;
  value: string;
  onChange: (v: string) => void;
}) {
  switch (spec.kind) {
    case "select":
      return (
        <select id="value" value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
          {spec.options?.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      );
    case "toggle":
      return (
        <select id="value" value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      );
    case "textarea":
      return (
        <textarea
          id="value"
          rows={5}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      );
    case "decimal":
      return (
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 mt-0.5 -translate-y-1/2 text-base text-muted">
            $
          </span>
          <input
            id="value"
            inputMode="decimal"
            required
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`${inputClass} pl-7`}
          />
        </div>
      );
    case "number":
      return (
        <input
          id="value"
          inputMode="numeric"
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      );
    default:
      return (
        <input
          id="value"
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      );
  }
}
