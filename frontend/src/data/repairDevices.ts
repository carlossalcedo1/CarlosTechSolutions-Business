// The devices the repair estimate offers to pick from. Newest first in every
// list: the phone in someone's hand is far likelier to be recent, and a long
// list read from the top should reach it fast. Within a year, the biggest
// model first (Pro Max, Pro, then the rest), matching how Apple lists them.
//
// A device type or line without a list here asks the customer to type the
// model in instead; see `entry` below.

export const DEVICE_TYPES = ["iPhone", "iPad", "MacBook", "Other"] as const;
export type DeviceType = (typeof DEVICE_TYPES)[number];

export const IPHONE_MODELS = [
  "iPhone 18 Pro Max",
  "iPhone 18 Pro",
  "iPhone 17e",
  "iPhone 17 Pro Max",
  "iPhone 17 Pro",
  "iPhone Air",
  "iPhone 17",
  "iPhone 16e",
  "iPhone 16 Pro Max",
  "iPhone 16 Pro",
  "iPhone 16 Plus",
  "iPhone 16",
  "iPhone 15 Pro Max",
  "iPhone 15 Pro",
  "iPhone 15 Plus",
  "iPhone 15",
  "iPhone SE (3rd generation)",
  "iPhone 14 Pro Max",
  "iPhone 14 Pro",
  "iPhone 14 Plus",
  "iPhone 14",
  "iPhone 13 Pro Max",
  "iPhone 13 Pro",
  "iPhone 13",
  "iPhone 13 mini",
  "iPhone 12 Pro Max",
  "iPhone 12 Pro",
  "iPhone 12",
  "iPhone 12 mini",
  "iPhone SE (2nd generation)",
  "iPhone 11 Pro Max",
  "iPhone 11 Pro",
  "iPhone 11",
  "iPhone XS Max",
  "iPhone XS",
  "iPhone XR",
  "iPhone X",
  "iPhone 8 Plus",
  "iPhone 8",
  "iPhone 7 Plus",
  "iPhone 7",
  "iPhone SE (1st generation)",
  "iPhone 6s Plus",
  "iPhone 6s",
  "iPhone 6 Plus",
  "iPhone 6",
  "iPhone 5s",
];

// iPads are picked in two steps, line then generation, because one list
// of every iPad ever would be the longest thing on the page. iPad Pro has
// no list and is typed in: there are too many sizes and generations to
// pick from usefully.
export const IPAD_LINES: { name: string; models?: string[] }[] = [
  {
    name: "iPad",
    models: [
      // Apple's own name for the 11th generation is "iPad (A16)"; both are
      // shown so either one is recognisable.
      "iPad (11th generation, A16)",
      "iPad (10th generation)",
      "iPad (9th generation)",
      "iPad (8th generation)",
      "iPad (7th generation)",
      "iPad (6th generation)",
      "iPad (5th generation)",
      "iPad (4th generation)",
    ],
  },
  {
    name: "iPad Air",
    models: [
      "iPad Air (M4)",
      "iPad Air (M3)",
      "iPad Air (M2)",
      "iPad Air (M1)",
      "iPad Air (4th generation)",
      "iPad Air (3rd generation)",
      "iPad Air 2",
      "iPad Air",
    ],
  },
  { name: "iPad Pro" },
  {
    name: "iPad mini",
    models: [
      "iPad mini (6th generation)",
      "iPad mini (5th generation)",
      "iPad mini 4",
      "iPad mini 3",
      "iPad mini 2",
      "iPad mini",
    ],
  },
];

// The "Other" choice at the bottom of a list, which swaps to typing.
export const OTHER = "Other";
