import { useState, type FormEvent } from "react";
import { submitTradeIn, ApiError } from "../lib/api";

// Apple's guide to locating an IMEI. Also linked from ContactPage's unlock
// flow — duplicated locally rather than shared, since it's a one-line const
// and the two pages don't otherwise share form state.
const IMEI_GUIDE = "https://support.apple.com/en-us/108037?device-type=iphone";

// Trade-in intake uses its own grading scale (mirrors the Notion database's
// Condition column: A-Like New / B-Good / C-Fair / D-Parts Only) rather
// than the public New/Excellent/Good/Fair labels used on listed items —
// intake grading and resale grading are different concepts even though
// they sound similar, so keeping them as separate types avoids conflating
// "what the seller says" with "what we list it as" after inspection.
const CONDITIONS = ["Like new", "Good", "Fair", "Parts only"] as const;
const UNLOCK_STATUSES = ["Unlocked", "Carrier-locked", "Not sure"] as const;

export function SellDevicePage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    imei: "",
    condition: CONDITIONS[0] as (typeof CONDITIONS)[number],
    unlockStatus: UNLOCK_STATUSES[0] as (typeof UNLOCK_STATUSES)[number],
    notes: "",
  });
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await submitTradeIn({
        name: form.name,
        email: form.email,
        phone: form.phone,
        imei: form.imei,
        condition: form.condition,
        unlock_status: form.unlockStatus,
        notes: form.notes,
      });
      setSent(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Something went wrong sending this — try again, or reach us directly on the Contact page.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-xl font-semibold text-ink">Sell or trade in your device</h1>
      <p className="mt-2 text-sm text-muted">
        Tell us about your device and we&apos;ll follow up with an offer.
      </p>

      <div className="mt-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
        As of now we are only accepting Apple devices for trade-in.
      </div>

      {sent ? (
        <p className="mt-6 rounded border border-hairline bg-surface p-4 text-sm text-ink">
          Thanks, {form.name || "there"} — we&apos;ll get back to you at {form.email} with an
          offer soon.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <div>
            <label className="text-sm text-muted">Name</label>
            <input
              required
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className="mt-1 w-full rounded border border-hairline px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-sm text-muted">Email</label>
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              className="mt-1 w-full rounded border border-hairline px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-sm text-muted">
              Phone <span className="text-muted/70">(optional)</span>
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="Best number to reach you"
              className="mt-1 w-full rounded border border-hairline px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-sm text-muted">IMEI number</label>
            <input
              required
              value={form.imei}
              onChange={(e) => set("imei", e.target.value)}
              placeholder="15 digits"
              inputMode="numeric"
              className="mt-1 w-full rounded border border-hairline px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-muted">
              Not sure where to find it?{" "}
              <a
                href={IMEI_GUIDE}
                target="_blank"
                rel="noreferrer"
                className="text-brand hover:underline"
              >
                Apple&apos;s guide to finding your IMEI
              </a>
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm text-muted">Condition</label>
              <select
                value={form.condition}
                onChange={(e) => set("condition", e.target.value as (typeof CONDITIONS)[number])}
                className="mt-1 w-full rounded border border-hairline bg-white px-3 py-2 text-sm"
              >
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-muted">Unlock status</label>
              <select
                value={form.unlockStatus}
                onChange={(e) =>
                  set("unlockStatus", e.target.value as (typeof UNLOCK_STATUSES)[number])
                }
                className="mt-1 w-full rounded border border-hairline bg-white px-3 py-2 text-sm"
              >
                {UNLOCK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm text-muted">
              Anything else we should know? <span className="text-muted/70">(optional)</span>
            </label>
            <textarea
              rows={5}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Model, storage, cracks, battery health, accessories included, ship or drop off, etc."
              className="mt-1 w-full rounded border border-hairline px-3 py-2 text-sm"
            />
          </div>

          {error && (
            <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-full bg-brand px-7 py-3 text-sm font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Sending…" : "Submit trade-in"}
          </button>
        </form>
      )}
    </div>
  );
}
