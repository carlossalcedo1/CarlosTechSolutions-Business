import type { Category } from "../types";

// Single source of truth for the category list — used by the header nav
// row, the homepage category tiles, and the shop page filter chips, so
// they can never drift out of sync with each other.
export const CATEGORIES: Category[] = ["Phones", "Tablets", "Computers", "Accessories"];

/**
 * Two inboxes, split by what the message is asking for. Keeping them apart
 * means a repair request never gets buried under "is this still available?"
 * — and later, the API can route form submissions to the right one.
 */
/** Someone wants you to DO something: repair, unlock, trade-in, return, pickup. */
export const REQUEST_EMAIL = "request@carlostechsolutions.com";
/** Someone wants to KNOW something: availability, pricing, general questions. */
export const INQUIRY_EMAIL = "inquiry@carlostechsolutions.com";
export const CONTACT_PHONE = "(305) 763-2541";

// Same profile linked from promptworks/frontend's footer (data/people.js) —
// kept as one source here too so it's not hand-typed twice across repos.
export const FACEBOOK_MARKETPLACE_URL =
  "https://www.facebook.com/marketplace/profile/100038115972128/";
