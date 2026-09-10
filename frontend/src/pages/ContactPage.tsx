import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { INQUIRY_EMAIL, REQUEST_EMAIL, CONTACT_PHONE } from "../lib/constants";
import { submitContact, ApiError } from "../lib/api";

// Apple's guide to locating an IMEI. Swap this for your own walkthrough
// once you write one.
const IMEI_GUIDE = "https://support.apple.com/en-us/108037?device-type=iphone";

const REPAIR_TYPES = ["Battery", "Screen", "Back glass", "Other"];
const REPAIR_BRANDS = ["Apple", "Samsung", "Computer", "Other"];

/**
 * One form, several jobs. Product pages and the services page link here with
 * an `intent` so the buyer lands on a form that already knows why they came —
 * repair requests get the device questions, unlock requests get the IMEI
 * field, pickup requests get a written message. Everything collected here
 * ends up in the email that reaches you.
 */
export function ContactPage() {
  const [searchParams] = useSearchParams();
  const prefillItem = searchParams.get("item");
  const intent = searchParams.get("intent");

  const isPickup = intent === "pickup";
  const isRepair = intent === "repair";
  const isUnlock = intent === "unlock";

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    repairType: REPAIR_TYPES[0],
    brand: REPAIR_BRANDS[0],
    imei: "",
    message: prefillItem
      ? isPickup
        ? `${prefillItem}\n\nI would like to arrange local pickup.`
        : `Hi, I'm interested in the ${prefillItem}. Is it still available?`
      : "",
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
      await submitContact({
        name: form.name,
        email: form.email,
        phone: form.phone,
        message: form.message,
        // Only sent when actually relevant, so a general question's email
        // doesn't show a stray "Repair type: Battery" default.
        repair_type: isRepair ? form.repairType : undefined,
        device_brand: isRepair ? form.brand : undefined,
        imei: isUnlock ? form.imei : undefined,
      });
      setSent(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Something went wrong sending this — try again, or reach us directly below.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const heading = isPickup
    ? "Arrange local pickup"
    : isRepair
      ? "Request a repair quote"
      : isUnlock
        ? "Request a device unlock"
        : "Send us a message";

  // Repairs, unlocks and pickups are asking us to do something; everything
  // else is a question. Show whichever inbox matches why they're here.
  const directEmail = isRepair || isUnlock || isPickup ? REQUEST_EMAIL : INQUIRY_EMAIL;

  const messageLabel = isRepair
    ? "What's wrong with it?"
    : isUnlock
      ? "Anything else we should know?"
      : "Message";

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
        <div>
          <h1 className="text-xl font-semibold text-ink">{heading}</h1>

          {sent ? (
            <p className="mt-4 rounded border border-hairline bg-surface p-4 text-sm text-ink">
              Thanks, {form.name || "there"} — we&apos;ll get back to you at {form.email} soon.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
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

              {isRepair && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-sm text-muted">What needs fixing?</label>
                    <select
                      value={form.repairType}
                      onChange={(e) => set("repairType", e.target.value)}
                      className="mt-1 w-full rounded border border-hairline bg-white px-3 py-2 text-sm"
                    >
                      {REPAIR_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-muted">Device</label>
                    <select
                      value={form.brand}
                      onChange={(e) => set("brand", e.target.value)}
                      className="mt-1 w-full rounded border border-hairline bg-white px-3 py-2 text-sm"
                    >
                      {REPAIR_BRANDS.map((brand) => (
                        <option key={brand} value={brand}>
                          {brand}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {isUnlock && (
                <div>
                  <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                    We only unlock Apple devices.
                  </p>
                  <label className="mt-3 block text-sm text-muted">IMEI number</label>
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
              )}

              <div>
                <label className="text-sm text-muted">{messageLabel}</label>
                <textarea
                  required={!isUnlock}
                  rows={5}
                  value={form.message}
                  onChange={(e) => set("message", e.target.value)}
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
                {submitting ? "Sending…" : "Send"}
              </button>
            </form>
          )}
        </div>

        <div>
          <h2 className="text-lg font-semibold text-ink">Direct contact</h2>
          <p className="mt-2 text-sm text-muted">
            <a href={`mailto:${directEmail}`} className="hover:text-brand">
              {directEmail}
            </a>
          </p>
          <p className="text-sm text-muted">
            <a href={`tel:${CONTACT_PHONE}`} className="hover:text-brand">
              {CONTACT_PHONE}
            </a>{" "}
            <span className="text-muted/80">(Best way to reach me)</span>
          </p>

          <h2 className="mt-6 text-lg font-semibold text-ink">When to reach us</h2>
          <p className="mt-2 text-sm text-muted">
            Recommended hours of contact are 10AM - 10PM EST.
          </p>
        </div>
      </div>
    </div>
  );
}
