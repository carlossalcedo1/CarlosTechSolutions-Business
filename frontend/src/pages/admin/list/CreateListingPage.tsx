import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
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
import { createListing, ApiError, type AdminItem } from "../../../lib/api";
import type { Category, Condition } from "../../../types";

// scripts/add_item.py as a form. Same fields in the same order, the same
// derived title (Brand Model Storage — never typed), and the same server-
// side validation and photo conversion, because the API runs the CLI's own
// code. Built for a phone first: one column, 16px inputs, native selects,
// and photos straight from the camera roll.

const MAX_PHOTOS = 10;

type Photo = { file: File; url: string; key: string };

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
  const [photos, setPhotos] = useState<Photo[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<AdminItem | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Same rule as build_name() in backend/app/inventory.py.
  const title = useMemo(
    () => [brand, model, storage].map((s) => s.trim()).filter(Boolean).join(" "),
    [brand, model, storage],
  );

  // Object URLs hold the file in memory until revoked; leak enough of these
  // on a phone and the tab gets killed. Revoked one at a time on removal and
  // the rest on unmount — NOT in an effect keyed on `photos`, whose cleanup
  // would revoke every URL still on screen each time a photo was added or
  // reordered, since the new array reuses the same ones.
  const photosRef = useRef(photos);
  photosRef.current = photos;
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  function addPhotos(list: FileList | null) {
    if (!list) return;
    const room = MAX_PHOTOS - photos.length;
    const incoming = Array.from(list).slice(0, room).map((file) => ({
      file,
      url: URL.createObjectURL(file),
      key: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
    }));
    if (list.length > room) {
      setError(`Only ${MAX_PHOTOS} photos fit — kept the first ${room}.`);
    }
    setPhotos((prev) => [...prev, ...incoming]);
    // Reset so picking the same photo again still fires onChange.
    if (fileInput.current) fileInput.current.value = "";
  }

  function removePhoto(key: string) {
    setPhotos((prev) => {
      const gone = prev.find((p) => p.key === key);
      if (gone) URL.revokeObjectURL(gone.url);
      return prev.filter((p) => p.key !== key);
    });
  }

  /** Back to a blank form, keeping category, brand and condition — the
   *  next device in a batch is usually the same kind as the last. */
  function startAnother() {
    photos.forEach((p) => URL.revokeObjectURL(p.url));
    setPhotos([]);
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

  function makeCover(key: string) {
    setPhotos((prev) => {
      const chosen = prev.find((p) => p.key === key);
      return chosen ? [chosen, ...prev.filter((p) => p.key !== key)] : prev;
    });
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
    // Appended in display order: the server numbers them 1.jpg, 2.jpg… in
    // the order they arrive, and 1.jpg is the shop card's photo.
    photos.forEach((p) => form.append("photos", p.file, p.file.name));

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

        <section>
          <p className="text-sm font-medium text-ink">Photos</p>
          <p className="mt-1 text-xs text-muted">
            The first photo is the one on shop cards. HEIC is fine — everything is converted
            to JPEG, turned upright and resized.
          </p>

          {photos.length > 0 && (
            <ol className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {photos.map((p, i) => (
                <li key={p.key} className="relative overflow-hidden rounded-lg border border-hairline">
                  <PhotoThumb photo={p} />
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-ink/80 px-2 py-0.5 text-[11px] font-medium text-white">
                    {i === 0 ? "Cover" : i + 1}
                  </span>
                  <div className="flex border-t border-hairline text-xs">
                    {i > 0 && (
                      <button
                        type="button"
                        onClick={() => makeCover(p.key)}
                        className="flex-1 py-2 text-ink hover:bg-black/5"
                      >
                        Make cover
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removePhoto(p.key)}
                      aria-label={`Remove photo ${i + 1}`}
                      className="flex-1 py-2 text-red-700 hover:bg-red-50"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}

          {photos.length < MAX_PHOTOS && (
            <label className="mt-3 flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-hairline px-4 py-6 text-[15px] font-medium text-ink hover:border-ink">
              {/* No `capture` attribute on purpose: it forces the camera
                  open and skips the photo library, and the photos are
                  usually already taken. Without it a phone offers both. */}
              <input
                ref={fileInput}
                type="file"
                accept="image/*,.heic,.heif"
                multiple
                onChange={(e) => addPhotos(e.target.files)}
                className="sr-only"
              />
              {photos.length === 0 ? "Add photos" : "Add more photos"}
            </label>
          )}
        </section>

        <ErrorNote error={error} />

        <PillButton type="submit" disabled={saving} className="w-full sm:w-auto">
          {saving ? "Saving…" : "Create Listing"}
        </PillButton>
      </form>
    </div>
  );
}

/**
 * Wait until a just-saved photo is actually being served, giving up after
 * about three seconds either way.
 *
 * Vite's dev server keeps a list of public/ files and only learns about a
 * new one from its file watcher, which lags the write. Ask for the photo
 * in the meantime and Vite answers 200 with index.html — its SPA fallback
 * — so the "Listed" card showed a broken image for a photo that had saved
 * perfectly. (Measured: text/html straight after the write, image/jpeg a
 * second later.) A failed <img> load isn't cached, so retrying is enough.
 */
function imageReady(src: string, attempts = 12, delayMs = 250): Promise<void> {
  return new Promise((resolve) => {
    let tries = 0;
    const attempt = () => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => {
        if (++tries >= attempts) resolve();
        else setTimeout(attempt, delayMs);
      };
      img.src = src;
    };
    attempt();
  });
}

/** A preview, or the filename when the browser can't draw it — desktop
 *  Chrome can't render HEIC, though the server converts it fine. */
function PhotoThumb({ photo }: { photo: Photo }) {
  const [broken, setBroken] = useState(false);
  if (broken) {
    return (
      <div className="flex aspect-square items-center justify-center bg-surface p-2 text-center text-[11px] break-all text-muted">
        {photo.file.name}
      </div>
    );
  }
  return (
    <img
      src={photo.url}
      alt=""
      onError={() => setBroken(true)}
      className="aspect-square w-full bg-surface object-cover"
    />
  );
}
