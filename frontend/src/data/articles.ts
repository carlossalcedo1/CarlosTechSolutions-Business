// Mirrors the planned Mongo `knowledge_articles` collection.
export interface Article {
  title: string;
  slug: string;
  body: string;
  category: "Orders" | "Shipping" | "Returns" | "Trade-in" | "Device unlocking";
  tags: string[];
}

export const articles: Article[] = [
  {
    title: "How long does shipping take?",
    slug: "shipping-time",
    category: "Shipping",
    tags: ["shipping", "delivery"],
    body: "Orders placed on a business day ship the same day. Nationwide delivery usually lands within 3-4 days of dispatch.",
  },
  {
    title: "Do you ship outside Florida?",
    slug: "shipping-nationwide",
    category: "Shipping",
    tags: ["shipping"],
    body: "Yes — we ship anywhere in the US. Local pickup is also available in Gainesville and Miami, FL.",
  },
  {
    title: "Can I cancel or change my order?",
    slug: "order-changes",
    category: "Orders",
    tags: ["orders", "cancel"],
    body: "Message us as soon as possible after ordering — we can usually make changes before an item ships.",
  },
  {
    title: "What's covered if something goes wrong?",
    slug: "returns-coverage",
    category: "Returns",
    tags: ["returns", "refunds", "faults"],
    body: "You have 7 days from delivery to return a device for any reason, undisclosed hardware faults included — see the full return policy for details.",
  },
  {
    title: "How does the trade-in process work?",
    slug: "trade-in-process",
    category: "Trade-in",
    tags: ["trade-in", "sell"],
    body: "Tell us your device type and condition, get an instant estimate, then ship it in or drop it off to get paid.",
  },
  {
    title: "How is my trade-in price determined?",
    slug: "trade-in-pricing",
    category: "Trade-in",
    tags: ["trade-in", "pricing"],
    body: "Estimates are based on device type and condition. The final offer is confirmed after we inspect the device.",
  },
  {
    title: "Are unlocked devices legal to buy?",
    slug: "unlocking-legality",
    category: "Device unlocking",
    tags: ["unlocking", "icloud", "mdm"],
    body: "Yes. We verify ownership before unlocking any iCloud- or MDM-locked device — see The Clean Way on our About page.",
  },
  {
    title: "What does 'factory unlocked' mean?",
    slug: "factory-unlocked-meaning",
    category: "Device unlocking",
    tags: ["unlocking"],
    body: "A factory unlocked device works with any compatible carrier — it isn't tied to a specific network.",
  },
];
