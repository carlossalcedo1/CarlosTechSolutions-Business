import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AdminPageHeader } from "../../../components/AdminLayout";
import { PhotoPicker, imageReady, usePhotoPicker } from "../../../components/admin/PhotoPicker";
import {
  ErrorNote,
  Field,
  PillButton,
  PillLink,
  inputClass,
} from "../../../components/admin/ui";
import { CONDITIONS } from "../../../lib/constants";
import { copyText, copyWhenReady } from "../../../lib/clipboard";
import { createCode, ApiError, type AdminCode } from "../../../lib/api";
import type { Condition } from "../../../types";

// scripts/gen_code.py as a form: the add_item fields minus the shop-only
// ones (category, quantity, featured), plus how many days the code lasts
// and a description you can change. The code is copied the moment it
// exists, because the next thing you do is paste it to a buyer.

const DEFAULT_DAYS = 7; // codes.py's DEFAULT_LIFETIME_DAYS
const MAX_DAYS = 365; // codes.py's MAX_LIFETIME_DAYS

export function codeLink(code: string) {
  // Built from wherever the panel is open rather than SITE_URL, so a code
  // made against a dev server links to the dev server, and one made on the
  // live site links to the live site.
  return `${window.location.origin}/code/${code}`;
}

export function NewCodePage() {
  const [brand, setBrand] = useState("Apple");
  const [model, setModel] = useState("");
  const [storage, setStorage] = useState("");
  const [condition, setCondition] = useState<Condition>("A+ - Excellent");
  const [inventoryId, setInventoryId] = useState("");
  const [price, setPrice] = useState("");
  const [days, setDays] = useState(String(DEFAULT_DAYS));
  const [specLine, setSpecLine] = useState("");
  const [specs, setSpecs] = useState("");
  const [description, setDescription] = useState("");
  const picker = usePhotoPicker();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<AdminCode | null>(null);
  // "auto-failed" and "manual-failed" are told apart because they need
  // different advice: after the automatic copy fails, the buttons are the
  // next thing to try; after a button fails too, pointing at the button
  // again is useless, and selecting the text by hand is what's left.
  const [copied, setCopied] = useState<
    "code" | "link" | "auto-failed" | "manual-failed" | null
  >(null);

  const title = useMemo(
    () => [brand, model, storage].map((s) => s.trim()).filter(Boolean).join(" "),
    [brand, model, storage],
  );

  function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setError(null);
    setSaving(true);

    const form = new FormData();
    form.set("brand", brand);
    form.set("model", model);
    form.set("storage", storage);
    form.set("condition", condition);
    form.set("inventoryId", inventoryId);
    form.set("price", price);
    form.set("days", days);
    form.set("specLine", specLine);
    form.set("specs", specs);
    form.set("description", description);
    picker.appendTo(form);

    const request = createCode(form);
    // Claim the clipboard now, inside the tap, before anything is awaited —
    // see lib/clipboard.ts for why the order matters on an iPhone.
    const copying = copyWhenReady(request.then((c) => c.code));

    void (async () => {
      try {
        const record = await request;
        if (record.item.images[0]) await imageReady(record.item.images[0]);
        setCreated(record);
        setCopied((await copying) ? "code" : "auto-failed");
        window.scrollTo({ top: 0 });
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Couldn't generate the code.");
      } finally {
        setSaving(false);
      }
    })();
  }

  async function copy(what: "code" | "link") {
    if (!created) return;
    const ok = await copyText(what === "code" ? created.code : codeLink(created.code));
    setCopied(ok ? what : "manual-failed");
  }

  function startAnother() {
    picker.clear();
    setModel("");
    setStorage("");
    setInventoryId("");
    setPrice("");
    setDays(String(DEFAULT_DAYS));
    setSpecLine("");
    setSpecs("");
    setDescription("");
    setError(null);
    setCopied(null);
    setCreated(null);
    window.scrollTo({ top: 0 });
  }

  if (created) {
    const expires = new Date(created.expiresAt).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    return (
      <div className="mx-auto max-w-xl">
        <Link to="/admin/codes" className="inline-block text-sm text-muted hover:text-ink">
          &larr; Back to Codes
        </Link>
        <AdminPageHeader title="Code ready" description={`${created.item.name} — live now, no deploy needed.`} />

        <div className="mt-6 rounded-2xl border border-hairline bg-surface px-6 py-8 text-center">
          {/* select-all: one long-press selects the whole code, which is
              the last resort when a browser refuses clipboard access. */}
          <p className="font-mono text-5xl font-bold tracking-[0.3em] text-ink select-all">
            {created.code}
          </p>
          <p className="mt-3 text-sm text-muted" role="status">
            {copied === "code" && "Copied to your clipboard."}
            {copied === "link" && "Link copied to your clipboard."}
            {copied === "auto-failed" && "Couldn't copy automatically — use the buttons below."}
            {copied === "manual-failed" &&
              "This browser blocked copying. Tap and hold the code to select it instead."}
          </p>
          <p className="mt-1 text-sm text-muted">Works for one sale. Expires {expires}.</p>
          <p className="mt-4 text-xs break-all text-muted select-all">{codeLink(created.code)}</p>
          <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
            <PillButton onClick={() => void copy("code")}>Copy code</PillButton>
            <PillButton tone="outline" onClick={() => void copy("link")}>
              Copy link
            </PillButton>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <PillButton tone="outline" onClick={startAnother}>
            Generate another
          </PillButton>
          <PillLink to="/admin/codes" tone="outline">
            Back to Codes
          </PillLink>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <Link to="/admin/codes" className="inline-block text-sm text-muted hover:text-ink">
        &larr; Back to Codes
      </Link>
      <AdminPageHeader
        title="Generate Code"
        description="Same as gen_code.py. A private listing only someone with the code can open — for a sale arranged elsewhere."
      />

      <form onSubmit={submit} className="mt-6 space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <Field label="Brand" htmlFor="brand">
            <input id="brand" required value={brand} onChange={(e) => setBrand(e.target.value)} className={inputClass} />
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
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="289.99"
                className={`${inputClass} pl-7`}
              />
            </div>
          </Field>
          <Field label="Expires in (days)" htmlFor="days" hint={`1 to ${MAX_DAYS}.`}>
            <input
              id="days"
              required
              inputMode="numeric"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Short spec line" htmlFor="specLine">
          <input
            id="specLine"
            required
            value={specLine}
            onChange={(e) => setSpecLine(e.target.value)}
            placeholder="128GB · Unlocked"
            className={inputClass}
          />
        </Field>

        <Field label="Spec bullets" htmlFor="specs" hint="One per line.">
          <textarea
            id="specs"
            required
            rows={4}
            value={specs}
            onChange={(e) => setSpecs(e.target.value)}
            placeholder={"Battery health 91%\nFactory unlocked"}
            className={inputClass}
          />
        </Field>

        <Field
          label="Description"
          htmlFor="description"
          hint="Leave blank for the standard paragraph — the same as pressing Enter in gen_code.py."
        >
          <textarea
            id="description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="All functions have been tested and function without issue unless explicitly stated above. View our return policy before purchase."
            className={inputClass}
          />
        </Field>

        <PhotoPicker picker={picker} coverHint="The first photo is the one the buyer sees first." />

        <ErrorNote error={error} />

        <PillButton type="submit" disabled={saving} className="w-full sm:w-auto">
          {saving ? "Generating…" : "Generate Code"}
        </PillButton>
      </form>
    </div>
  );
}
