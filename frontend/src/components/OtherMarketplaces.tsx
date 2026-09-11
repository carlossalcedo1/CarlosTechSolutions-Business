import type { ReactNode } from "react";
import { EBAY_PROFILE_URL, FACEBOOK_MARKETPLACE_URL } from "../lib/constants";

// The other places we sell, shown in the same 2x2 hairline grid as the
// homepage's "Why buy from us" promises. A card only becomes a link once it
// has a `url` — add your Mercari and Depop profile links below and those
// cards start linking out, same as eBay's and Facebook's already do.
//
// Icons are simple marks in each platform's brand color, not their official
// logo files — swap in the real ones from each brand's press kit if you like.

const ICON = "h-8 w-8";

const MARKETPLACES: Array<{ name: string; body: string; url?: string; icon: ReactNode }> = [
  {
    name: "eBay",
    body: "Our listings, backed by eBay's Money Back Guarantee.",
    url: EBAY_PROFILE_URL,
    icon: (
      <svg viewBox="0 0 48 48" className={ICON} aria-hidden>
        <text x="24" y="32" fontSize="23" fontWeight="700" textAnchor="middle" letterSpacing="-1.5">
          <tspan fill="#e53238">e</tspan>
          <tspan fill="#0064d2">b</tspan>
          <tspan fill="#f5af02">a</tspan>
          <tspan fill="#86b817">y</tspan>
        </text>
      </svg>
    ),
  },
  {
    name: "Facebook Marketplace",
    body: "Local pickup deals, plus reviews from our buyers.",
    url: FACEBOOK_MARKETPLACE_URL,
    icon: (
      <svg viewBox="0 0 24 24" className={ICON} fill="#1877f2" aria-hidden>
        <path d="M22 12a10 10 0 10-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.7l-.4 2.9h-2.3v7A10 10 0 0022 12z" />
      </svg>
    ),
  },
  {
    name: "Mercari",
    body: "Shipped nationwide, with Mercari's buyer protection.",
    icon: (
      <svg viewBox="0 0 48 48" className={ICON} aria-hidden>
        <circle cx="24" cy="24" r="20" fill="#5356ee" />
        <text x="24" y="31" fontSize="20" fontWeight="700" fill="#fff" textAnchor="middle">
          m
        </text>
      </svg>
    ),
  },
  {
    name: "Depop",
    body: "Find our latest drops on Depop.",
    icon: (
      <svg viewBox="0 0 48 48" className={ICON} aria-hidden>
        <rect x="4" y="4" width="40" height="40" rx="10" fill="#ff2300" />
        <text x="24" y="31" fontSize="20" fontWeight="700" fill="#fff" textAnchor="middle">
          d
        </text>
      </svg>
    ),
  },
];

export function OtherMarketplaces() {
  return (
    <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline sm:grid-cols-2">
      {MARKETPLACES.map((marketplace) => {
        const content = (
          <>
            {marketplace.icon}
            <h3 className="mt-4 font-semibold text-ink">
              {marketplace.name}
              {marketplace.url && (
                <span aria-hidden className="ml-1.5 text-muted">
                  &rarr;
                </span>
              )}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{marketplace.body}</p>
          </>
        );

        return marketplace.url ? (
          <a
            key={marketplace.name}
            href={marketplace.url}
            target="_blank"
            rel="noreferrer"
            className="bg-white p-6 transition hover:bg-surface"
          >
            {content}
          </a>
        ) : (
          <div key={marketplace.name} className="bg-white p-6">
            {content}
          </div>
        );
      })}
    </div>
  );
}
