// The catalog. GENERATED DATA — do not hand-edit items.json; add inventory
// with `python backend/scripts/add_item.py`, which validates every field
// against the same Pydantic model the checkout endpoint uses.
//
// The cast below is deliberate: JSON imports widen "Tablets" to `string`, so
// TypeScript can't confirm the union fields on its own. The real guarantee
// comes from the Python side — the CLI refuses to write an invalid item, and
// the backend re-validates this file on boot, so a bad category fails loudly
// at startup rather than silently at checkout.
import type { Item } from "../types";
import data from "./items.json";

export const items = data as unknown as Item[];

export function getItemById(id: string): Item | undefined {
  return items.find((item) => item.id === id);
}
