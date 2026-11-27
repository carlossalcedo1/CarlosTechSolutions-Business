// Trade-in offers for "Sell a Device", by model name exactly as it appears
// in data/repairDevices.ts. Empty for now: a model with no entry here (and
// anything typed in) gets "we'll text you an offer" instead of a number.
//
// One entry per model, because what a crack or a weak battery costs you
// depends on the phone — a cracked back on an iPhone 8 is a cheap fix, on
// an iPhone 15 Pro it isn't. Every amount is in cents. `base` is the offer
// for the best case: A+, battery 90%+, not locked. Everything else is taken
// off that.
//
// e.g. "iPhone 13": {
//   base: 30000, partsOnly: 6000,
//   less: { conditionB: 4000, crackedFront: 8000, crackedBack: 5000,
//           battery80: 2000, battery79: 4000,
//           iCloudLocked: 20000, passcodeLocked: 15000, carrierLocked: 6000 },
// }

export type SellPrice = {
  base: number;
  // A flat offer for a parts-only device, replacing base and the condition
  // deductions. Battery and lock status still come off it.
  partsOnly?: number;
  less: Partial<Record<Deduction, number>>;
};

export type Deduction =
  | "conditionB"
  | "crackedFront"
  | "crackedBack"
  | "battery80"
  | "battery79"
  | "iCloudLocked"
  | "passcodeLocked"
  | "carrierLocked";

export const SELL_PRICES: Record<string, SellPrice> = {};

// --- The questions -------------------------------------------------------------

// The A+, B and C wording is the same as the conditions box on /shop, so a
// grade means one thing whether you're buying or selling. The only cut is
// "check the photos" on C, which is about a listing and means nothing here,
// and the battery sentences: battery is its own question right after.
// Keep the two in step if either changes.
export const CONDITIONS = [
  {
    value: "A+",
    label: "A+ - Excellent",
    detail: "Minor to no scuffs or scratches on the front glass, back glass or housing.",
  },
  {
    value: "B",
    label: "B - Good",
    detail: "Noticeable scuffs or scratches on the front glass, back glass or housing.",
  },
  {
    value: "C",
    label: "C - Fair",
    detail:
      "Noticeable scuffs or scratches on the front glass, back glass or housing, and may include cracks.",
  },
  {
    value: "Parts",
    label: "Parts only",
    detail: "Doesn't power on, or too damaged to use — sold for its parts.",
  },
] as const;
export type Condition = (typeof CONDITIONS)[number]["value"];

export const BATTERY = [
  { value: "90", label: "90% or higher" },
  { value: "80", label: "80% – 89%" },
  { value: "79", label: "79% or lower" },
] as const;
export type Battery = (typeof BATTERY)[number]["value"];

export const LOCK_STATUS = [
  { value: "unlocked", label: "iCloud unlocked" },
  { value: "iCloud", label: "iCloud locked" },
  { value: "passcode", label: "Passcode locked" },
  { value: "carrier", label: "Carrier locked" },
] as const;
export type LockStatus = (typeof LOCK_STATUS)[number]["value"];

export type SellAnswers = {
  condition: Condition | "";
  crackedFront: "yes" | "no" | "";
  crackedBack: "yes" | "no" | "";
  battery: Battery | "";
  lock: LockStatus | "";
};

export const NO_ANSWERS: SellAnswers = {
  condition: "",
  crackedFront: "",
  crackedBack: "",
  battery: "",
  lock: "",
};

/** Whether every question that applies has been answered. Cracks are only
 * asked for C — A+ and B mean no cracks, and parts only doesn't care. */
export function answered(a: SellAnswers): boolean {
  if (!a.condition || !a.battery || !a.lock) return false;
  if (a.condition === "C") return !!a.crackedFront && !!a.crackedBack;
  return true;
}

/**
 * The offer in cents, or null when it can't be priced from the table: the
 * model has no entry, or an amount this combination needs is missing. A
 * missing number means "ask", never "nothing off". So does an offer that
 * comes to nothing.
 */
export function offerFor(model: string, a: SellAnswers): number | null {
  const price = SELL_PRICES[model];
  if (!price || !answered(a)) return null;

  const take: Deduction[] = [];
  let start: number | undefined = price.base;
  if (a.condition === "Parts") start = price.partsOnly;
  if (a.condition === "B") take.push("conditionB");
  if (a.condition === "C") {
    if (a.crackedFront === "yes") take.push("crackedFront");
    if (a.crackedBack === "yes") take.push("crackedBack");
  }
  if (a.battery === "80") take.push("battery80");
  if (a.battery === "79") take.push("battery79");
  if (a.lock === "iCloud") take.push("iCloudLocked");
  if (a.lock === "passcode") take.push("passcodeLocked");
  if (a.lock === "carrier") take.push("carrierLocked");

  if (start == null) return null;
  let offer = start;
  for (const d of take) {
    const amount = price.less[d];
    if (amount == null) return null;
    offer -= amount;
  }
  // Deductions can outrun the starting price (a locked, cracked phone).
  // "We'll pay $0" reads as a refusal; asking leaves room for a parts offer.
  return offer > 0 ? offer : null;
}
