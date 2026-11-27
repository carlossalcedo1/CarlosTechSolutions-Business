import { useMemo, useState, type FormEvent } from "react";
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
import { PhotoPicker, imageReady, usePhotoPicker } from "../../../components/admin/PhotoPicker";
import { CATEGORIES, CONDITIONS } from "../../../lib/constants";
import { createListing, ApiError, type AdminItem } from "../../../lib/api";
import type { Category, Condition } from "../../../types";

// scripts/add_item.py as a form. Same fields in the same order, the same
// derived title (Brand Model Storage — never typed), and the same server-
// side validation and photo conversion, because the API runs the CLI's own
// code. Built for a phone first: one column, 16px inputs, native selects,
// and photos straight from the camera roll.

export function CreateListingPage() {
  const [category, setCategory] = useState<Category>("Phones");
  const [brand, setBrand] = useState("Apple");
  const [model, setModel] = useState("");
  const [storage, setStorage] = useState("");
  const [condition, setCondition] = useState<Condition>("A+ - Excellent");
  const [inventoryId, setInventoryId] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [specLine, setSpecLine] = useState("");
  const [specs, setSpecs] = useState("");
  const [featured, setFeatured] = useState(false);
  const picker = usePhotoPicker();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<AdminItem | null>(null);

  // Same rule as build_name() in backend/app/inventory.py.
  const title = useMemo(
    () => [brand, model, storage].map((s) => s.trim()).filter(Boolean).join(" "),
    [brand, model, storage],
  );

  /** Back to a blank form, keeping category, brand and condition — the
   *  next device in a batch is usually the same kind as the last. */
  function startAnother() {
    picker.clear();
    setModel("");
    setStorage("");
    setInventoryId("");
    setPrice("");
    setQuantity("1");
    setSpecLine("");
    setSpecs("");
    setFeatured(false);
    setError(null);
    setCreated(null);
    window.scrollTo({ top: 0 });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setError(null);
    setSaving(true);

    const form = new FormData();
    form.set("category", category);
    form.set("brand", brand);
    form.set("model", model);
    form.set("storage", storage);
    form.set("condition", condition);
    form.set("inventoryId", inventoryId);
    form.set("price", price);
    form.set("quantity", quantity);
    form.set("specLine", specLine);
    form.set("specs", specs);
    form.set("featured", featured ? "true" : "false");
    picker.appendTo(form);

    try {
      const item = await createListing(form);
      if (item.images[0]) await imageReady(item.images[0]);
      setCreated(item);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save the listing.");
    } finally {
      setSaving(false);
    }
  }

  if (created) {
    return (
      <div className="mx-auto max-w-xl">
        <BackToList />
        <AdminPageHeader
          title="Listed"
          description="Saved to the catalog. It reaches the shop when you deploy."
        />
        <div className="mt-6 max-w-xs">
          <ProductCard item={created} />
        </div>
        <div className="mt-8">
          <DeployPanel compact />
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <PillButton tone="outline" onClick={startAnother}>
            Create another
          </PillButton>
          <PillLink to="/admin/list" tone="outline">
            Back to List
          </PillLink>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <BackToList />
      <AdminPageHeader
        title="Create Listing"
        description="Same as add_item.py. The title is built for you from brand, model and storage."
      />

      <form onSubmit={submit} className="mt-6 space-y-5">
        <Field label="Category" htmlFor="category">
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            className={inputClass}
          >
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <Field label="Brand" htmlFor="brand">
            <input
              id="brand"
              required
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Model" htmlFor="model">
            <input
              id="model"
              required
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="iPhone 13"
              className={inputClass}
            />
          </Field>
          <Field label="Storage" htmlFor="storage">
            <input
              id="storage"
              required
              value={storage}
              onChange={(e) => setStorage(e.target.value)}
              placeholder="128GB"
              className={inputClass}
            />
          </Field>
        </div>

        <p className="-mt-2 text-sm text-muted">
          Title: <span className="font-medium text-ink">{title || "—"}</span>
        </p>

        <Field label="Condition" htmlFor="condition">
          <select
            id="condition"
            value={condition}
            onChange={(e) => setCondition(e.target.value as Condition)}
            className={inputClass}
          >
            {CONDITIONS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>

        <Field label="Inventory ID" htmlFor="inventoryId" hint="Cross-references your Notion database.">
          <input
            id="inventoryId"
            required
            value={inventoryId}
            onChange={(e) => setInventoryId(e.target.value)}
            placeholder="CTS-0142"
            autoCapitalize="characters"
            className={inputClass}
          />
        </Field>

        <div className="grid grid-cols-2 gap-5">
          <Field label="Price" htmlFor="price">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 mt-0.5 -translate-y-1/2 text-base text-muted">
                $
              </span>
              <input
                id="price"
                required
                // decimal, not numeric: numeric gives an iPhone a keypad
                // with no decimal point, so $289.99 becomes impossible.
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="289.99"
                className={`${inputClass} pl-7`}
              />
            </div>
          </Field>
          <Field label="Quantity" htmlFor="quantity">
            <input
              id="quantity"
              required
              inputMode="numeric"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Short spec line" htmlFor="specLine" hint="The grey line under the name on shop cards.">
          <input
            id="specLine"
            required
            value={specLine}
            onChange={(e) => setSpecLine(e.target.value)}
            placeholder="128GB · Unlocked"
            className={inputClass}
          />
        </Field>

        <Field label="Spec bullets" htmlFor="specs" hint="One per line. These are the bullets on the product page.">
          <textarea
            id="specs"
            required
            rows={4}
            value={specs}
            onChange={(e) => setSpecs(e.target.value)}
            placeholder={"Battery health 91%\nFactory unlocked\nNo scratches on screen"}
            className={inputClass}
          />
        </Field>

        <label className="flex cursor-pointer items-center gap-3 text-[15px] text-ink">
          <input
            type="checkbox"
            checked={featured}
            onChange={(e) => setFeatured(e.target.checked)}
            className="h-5 w-5 accent-brand"
          />
          Feature on the homepage
        </label>

        <PhotoPicker picker={picker} coverHint="The first photo is the one on shop cards." />

        <ErrorNote error={error} />

        <PillButton type="submit" disabled={saving} className="w-full sm:w-auto">
          {saving ? "Saving…" : "Create Listing"}
        </PillButton>
      </form>
    </div>
  );
}
