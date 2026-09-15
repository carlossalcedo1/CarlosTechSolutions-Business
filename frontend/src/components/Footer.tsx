import { Link } from "react-router-dom";
import { INQUIRY_EMAIL, CONTACT_PHONE, EBAY_PROFILE_URL } from "../lib/constants";
import { CleanWayMark } from "./CleanWayMark";

type FooterLink = {
  label: string;
  to: string;
  /** Renders the leaf mark before the label (used for The Clean Way). */
  mark?: boolean;
};

// Column structure mirrors the reference footer (brand block + three link
// columns), with the columns reassigned to this business: what you can buy,
// what you can hire us for, and who we are.
const COLUMNS: Array<{ heading: string; links: FooterLink[] }> = [
  {
    heading: "Shop",
    links: [
      { label: "All inventory", to: "/shop" },
      { label: "Phones", to: "/shop?category=Phones" },
      { label: "Tablets", to: "/shop?category=Tablets" },
      { label: "Computers", to: "/shop?category=Computers" },
      { label: "Accessories", to: "/shop?category=Accessories" },
    ],
  },
  {
    heading: "Services",
    links: [
      { label: "Device unlocking", to: "/services" },
      { label: "Sell or trade in", to: "/sell" },
      { label: "Fix your device", to: "/services" },
      { label: "Return policy", to: "/returns" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About us", to: "/about" },
      { label: "The Clean Way", to: "/about#clean-way", mark: true },
      { label: "Help center", to: "/help" },
      { label: "Contact", to: "/contact" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-auto border-t border-hairline bg-surface">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-6 py-16 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
        {/* Brand block */}
        <div>
          <Link to="/" className="flex items-center gap-3">
            {/* Same placeholder as the header — see Header.tsx's comment.
                Swap /public/logo.svg for the real mark when it's ready. */}
            <img src="/logo.svg" alt="" className="h-[25px] w-[25px]" />
            <span className="text-xl font-bold tracking-tight text-ink">CarlosTechSolutions</span>
          </Link>

          <p className="mt-5 max-w-xs text-[15px] leading-relaxed text-muted">
            Your one stop shop for all your tech needs.
          </p>

          <div className="mt-8">
            <p className="font-semibold text-ink">Carlos Salcedo</p>
            <ul className="mt-2 space-y-1.5 text-[15px] text-muted">
              <li>
                <a href={`mailto:${INQUIRY_EMAIL}`} className="hover:text-ink">
                  {INQUIRY_EMAIL}
                </a>
              </li>
              <li>
                <a href={`tel:${CONTACT_PHONE}`} className="hover:text-ink">
                  {CONTACT_PHONE}
                </a>
              </li>
              <li>Gainesville, FL</li>
            </ul>

            <div className="mt-4 flex items-center gap-4 text-muted">
              <a
                href="https://www.facebook.com/marketplace"
                target="_blank"
                rel="noreferrer"
                aria-label="Facebook Marketplace"
                className="hover:text-ink"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22 12a10 10 0 10-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.7l-.4 2.9h-2.3v7A10 10 0 0022 12z" />
                </svg>
              </a>
              <a
                href={EBAY_PROFILE_URL}
                target="_blank"
                rel="noreferrer"
                aria-label="eBay"
                className="hover:opacity-80"
              >
                <svg width="34" height="18" viewBox="0 0 48 24" aria-hidden>
                  <text x="24" y="19" fontSize="18" fontWeight="700" textAnchor="middle" letterSpacing="-1">
                    <tspan fill="#e53238">e</tspan>
                    <tspan fill="#0064d2">b</tspan>
                    <tspan fill="#f5af02">a</tspan>
                    <tspan fill="#86b817">y</tspan>
                  </text>
                </svg>
              </a>
              <a href={`mailto:${INQUIRY_EMAIL}`} aria-label="Email" className="hover:text-ink">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <rect x="2.5" y="4.5" width="19" height="15" rx="2" />
                  <path d="M3 6l9 6.5L21 6" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        {/* Link columns */}
        {COLUMNS.map((column) => (
          <div key={column.heading}>
            <p className="font-semibold text-ink">{column.heading}</p>
            <ul className="mt-4 space-y-3 text-[15px] text-muted">
              {column.links.map((link) => (
                <li key={link.label}>
                  <Link to={link.to} className="inline-flex items-center gap-1.5 hover:text-ink">
                    {link.mark && <CleanWayMark className="h-4 w-4" />}
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-hairline">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-5 text-xs text-muted sm:flex-row sm:justify-between">
          <p>&copy; {new Date().getFullYear()} CarlosTechSolutions. Ships nationwide.</p>
          <div className="flex gap-4">
            <Link to="/terms" className="hover:text-ink">
              Terms of service
            </Link>
            <Link to="/privacy" className="hover:text-ink">
              Privacy policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
