import { useState } from "react";
import type { Category } from "../types";

// Trade-in intake uses its own grading scale (mirrors the Notion database's
// Condition column: A-Like New / B-Good / C-Fair / D-Parts Only) rather
// than the public New/Excellent/Good/Fair labels used on listed items —
// intake grading and resale grading are different concepts even though
// they sound similar, so keeping them as separate types avoids conflating
// "what the seller says" with "what we list it as" after inspection.
type TradeInCondition = "Like new" | "Good" | "Fair" | "Parts only";

const DEVICE_TYPES: Category[] = ["Phones", "Tablets", "Laptops", "Desktops"];
const CONDITIONS: TradeInCondition[] = ["Like new", "Good", "Fair", "Parts only"];

// Rough base-price table just to make the "offer" step feel real. Stage 2
// replaces this entirely with `POST /trade-in`, which returns a real
// quoted price for `trade_in_submissions` instead of a client-side guess.
const BASE_PRICE: Record<Category, number> = {
  Phones: 220,
  Tablets: 180,
  Laptops: 320,
  Desktops: 150,
  Accessories: 30,
};

const CONDITION_MULTIPLIER: Record<TradeInCondition, number> = {
  "Like new": 1,
  Good: 0.75,
  Fair: 0.5,
  "Parts only": 0.2,
};

const STEPS = ["Device type", "Condition", "Get your offer", "Ship or drop off", "Get paid"];

export function SellDevicePage() {
  const [step, setStep] = useState(0);
  const [deviceType, setDeviceType] = useState<Category | null>(null);
  const [condition, setCondition] = useState<TradeInCondition | null>(null);
  const [fulfillment, setFulfillment] = useState<"ship" | "drop-off" | null>(null);
  const [contact, setContact] = useState({ name: "", email: "" });
  const [submitted, setSubmitted] = useState(false);

  const offer = deviceType && condition ? Math.round(BASE_PRICE[deviceType] * CONDITION_MULTIPLIER[condition]) : null;

  const canAdvance =
    (step === 0 && deviceType !== null) ||
    (step === 1 && condition !== null) ||
    step === 2 ||
    (step === 3 && fulfillment !== null) ||
    step === 4;

  function goTo(index: number) {
    // Only allow jumping to a step that's already reachable — mirrors the
    // wireframe's clickable step tabs without letting someone skip ahead
    // of data they haven't provided yet.
    if (index <= step) setStep(index);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-ink">Get a quote in minutes</h1>
        <p className="mt-2 text-muted">
          Tell us about your device, we&apos;ll offer a fair price - ship it in or drop it off.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {STEPS.map((label, i) => (
          <button
            key={label}
            onClick={() => goTo(i)}
            className={`rounded border px-2 py-3 text-center text-xs font-medium sm:text-sm ${
              i === step
                ? "border-ink bg-gray-100 text-ink"
                : i < step
                  ? "border-hairline text-ink"
                  : "border-hairline text-muted"
            }`}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>

      <div className="mt-8 rounded border border-hairline p-6">
        {step === 0 && (
          <div>
            <h2 className="font-semibold text-ink">What are you trading in?</h2>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {DEVICE_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => setDeviceType(type)}
                  className={`rounded border px-3 py-4 text-sm font-medium ${
                    deviceType === type ? "border-brand bg-blue-50 text-brand" : "border-hairline text-ink"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <h2 className="font-semibold text-ink">What condition is it in?</h2>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CONDITIONS.map((c) => (
                <button
                  key={c}
                  onClick={() => setCondition(c)}
                  className={`rounded border px-3 py-4 text-sm font-medium ${
                    condition === c ? "border-brand bg-blue-50 text-brand" : "border-hairline text-ink"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="text-center">
            <h2 className="font-semibold text-ink">Your estimated offer</h2>
            <p className="mt-3 text-4xl font-semibold text-brand">${offer}</p>
            <p className="mt-2 text-sm text-muted">
              Estimate for a {condition?.toLowerCase()} {deviceType?.slice(0, -1).toLowerCase()}. Final offer is
              confirmed after we inspect the device.
            </p>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="font-semibold text-ink">Ship it in or drop it off?</h2>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                onClick={() => setFulfillment("ship")}
                className={`rounded border px-4 py-4 text-left text-sm ${
                  fulfillment === "ship" ? "border-brand bg-blue-50" : "border-hairline"
                }`}
              >
                <span className="font-medium text-ink">Ship it in</span>
                <p className="mt-1 text-muted">We&apos;ll email a prepaid shipping label.</p>
              </button>
              <button
                onClick={() => setFulfillment("drop-off")}
                className={`rounded border px-4 py-4 text-left text-sm ${
                  fulfillment === "drop-off" ? "border-brand bg-blue-50" : "border-hairline"
                }`}
              >
                <span className="font-medium text-ink">Drop it off</span>
                <p className="mt-1 text-muted">Gainesville or Miami, FL — by appointment.</p>
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                value={contact.name}
                onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))}
                placeholder="Your name"
                className="rounded border border-hairline px-3 py-2 text-sm"
              />
              <input
                value={contact.email}
                onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
                placeholder="Email"
                type="email"
                className="rounded border border-hairline px-3 py-2 text-sm"
              />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="text-center">
            {submitted ? (
              <>
                <h2 className="font-semibold text-ink">You&apos;re all set</h2>
                <p className="mt-2 text-muted">
                  We&apos;ll follow up at {contact.email || "the email you provided"} with next steps. Payment
                  goes out within 2 business days of us verifying the device.
                </p>
              </>
            ) : (
              <>
                <h2 className="font-semibold text-ink">Review &amp; submit</h2>
                <ul className="mt-3 space-y-1 text-sm text-muted">
                  <li>Device: {deviceType}</li>
                  <li>Condition: {condition}</li>
                  <li>Estimated offer: ${offer}</li>
                  <li>Fulfillment: {fulfillment === "ship" ? "Ship it in" : "Drop off"}</li>
                </ul>
                <button
                  onClick={() => setSubmitted(true)}
                  disabled={!contact.name || !contact.email}
                  className="mt-5 rounded bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Submit trade-in
                </button>
                {(!contact.name || !contact.email) && (
                  <p className="mt-2 text-xs text-muted">Add your name and email on the previous step first.</p>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-between">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="rounded border border-hairline px-4 py-2 text-sm text-ink disabled:opacity-40"
        >
          Back
        </button>
        {step < STEPS.length - 1 && (
          <button
            onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
            disabled={!canAdvance}
            className="rounded bg-ink px-4 py-2 text-sm text-white disabled:opacity-40"
          >
            Continue
          </button>
        )}
      </div>
    </div>
  );
}
