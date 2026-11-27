import { useState } from "react";
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
import { markListingSold, ApiError } from "../../../lib/api";
import { useAdminInventory } from "./useAdminInventory";

// "Delete" means sold, the way scripts/sold_item.py does it: the sale goes
// into your sold log with today's date, and the listing comes off once no
// units are left. Nothing is erased — which matters the first time a buyer
// emails about a device you no longer have a record of.

export function DeleteListingPage() {
  const { id = "" } = useParams();
  const { data, error: loadError, loading } = useAdminInventory();
  const item = data?.items.find((i) => i.id === id);

  const [units, setUnits] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ soldUnits: number; remaining: number; removed: boolean } | null>(null);

  if (loading) return <div className="h-40 animate-pulse rounded bg-black/5" />;
  if (loadError) return <ErrorNote error={loadError} />;

  if (result && item) {
    return (
      <div className="mx-auto max-w-xl">
        <BackToList />
        <AdminPageHeader
          title="Marked sold"
          description={
            result.removed
              ? `${item.name} is off the catalog and in your sold log. It leaves the shop when you deploy.`
              : `${result.soldUnits} sold, ${result.remaining} still listed. The change reaches the shop when you deploy.`
          }
        />
        <div className="mt-8">
          <DeployPanel compact />
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <PillLink to="/admin/list/delete" tone="outline">
            Mark another sold
          </PillLink>
          <PillLink to="/admin/list" tone="outline">
            Back to List
          </PillLink>
        </div>
      </div>
    );
  }

  if (!item || item.remaining === 0) {
    return (
      <div>
        <BackToList />
        <p className="mt-6 text-muted">
          {item ? "That listing has already sold." : "That listing isn't in the catalog anymore."}
        </p>
        <PillLink to="/admin/list/delete" tone="outline" className="mt-4">
          Pick another
        </PillLink>
      </div>
    );
  }

  // Capped at what's still for sale rather than the catalog's quantity:
  // anything already sold online has been counted once by Stripe, and
  // counting it again here would overstate what sold.
  const max = item.remaining;
  const chosen = units ?? max;

  async function confirm() {
    if (saving || !item) return;
    setSaving(true);
    setError(null);
    try {
      setResult(await markListingSold(item.id, chosen));
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't mark that sold.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <Link to="/admin/list/delete" className="inline-block text-sm text-muted hover:text-ink">
        &larr; Pick a different listing
      </Link>
      <AdminPageHeader title="Delete Listing" description={item.name} />

      <div className="mt-6 max-w-[14rem]">
        <ProductCard item={item} />
      </div>

      <section className="mt-8 rounded-2xl border border-hairline p-5">
        <p className="font-medium text-ink">Mark this as sold?</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          It moves to your sold log with today&apos;s date rather than being erased.
          {max === 1 || chosen === max
            ? " It comes off the catalog now, and off the shop when you deploy."
            : ` ${max - chosen} will stay listed.`}
        </p>

        {max > 1 && (
          <div className="mt-4 max-w-[12rem]">
            <Field label="How many sold?" htmlFor="units">
              <select
                id="units"
                value={chosen}
                onChange={(e) => setUnits(Number(e.target.value))}
                className={inputClass}
              >
                {Array.from({ length: max }, (_, n) => n + 1).map((n) => (
                  <option key={n} value={n}>
                    {n === max ? `All ${n}` : n}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}

        <div className="mt-4">
          <ErrorNote error={error} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <PillButton onClick={() => void confirm()} disabled={saving}>
            {saving ? "Saving…" : "Mark as sold"}
          </PillButton>
          <PillLink to="/admin/list" tone="outline">
            Cancel
          </PillLink>
        </div>
      </section>
    </div>
  );
}
