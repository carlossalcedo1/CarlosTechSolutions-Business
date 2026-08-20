// Shared types for the app.
//
// These are deliberately shaped to match the *public-safe* fields of the
// planned Mongo `items` collection (see brief: "Backend plan" + "Notion
// integration"). Internal-only fields (cost, serial number, original
// seller, sold-to, bypass method) never appear here — they don't belong
// in frontend code even as mock data, since this shape is what Stage 2's
// real API response will look like.

export type Category =
  | "Phones"
  | "Tablets"
  | "Laptops"
  | "Desktops"
  | "Accessories";

export type Condition = "New" | "Excellent" | "Good" | "Fair";

export interface Item {
  id: string;
  name: string;
  category: Category;
  brand: string;
  condition: Condition;
  price: number;
  specs: string[];
  /** Short spec line shown on cards, e.g. "128GB . Unlocked" */
  specLine: string;
  description: string;
  images: string[];
  factoryUnlocked: boolean;
  featured: boolean;
  dateAdded: string; // ISO date
}
