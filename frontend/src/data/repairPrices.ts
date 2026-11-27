// Repair prices for the estimate on the Services page, by model name
// exactly as it appears in data/repairDevices.ts. Empty for now: any model
// without a price here (and anything typed in) reads "Contact for pricing"
// rather than a number that might not be honoured.
//
// Prices are in cents, like everything else priced on the site.

export const REPAIR_SERVICES = [
  "Screen",
  "Back Glass",
  "Battery Service",
  "Charging Port",
] as const;
export type RepairService = (typeof REPAIR_SERVICES)[number];

// e.g. "iPhone 15": { Screen: 12900, "Battery Service": 6900 }
export const REPAIR_PRICES: Record<string, Partial<Record<RepairService, number>>> = {};
