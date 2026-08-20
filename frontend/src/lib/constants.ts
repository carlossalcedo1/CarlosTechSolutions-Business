import type { Category } from "../types";

// Single source of truth for the category list — used by the header nav
// row, the homepage category tiles, and the shop page filter chips, so
// they can never drift out of sync with each other.
export const CATEGORIES: Category[] = [
  "Phones",
  "Tablets",
  "Laptops",
  "Desktops",
  "Accessories",
];

export const CONTACT_EMAIL = "hello@carlostech.com";
export const CONTACT_PHONE = "(352) 555-0148";
