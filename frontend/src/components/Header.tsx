import { Link, NavLink } from "react-router-dom";
import { CleanWayMark } from "./CleanWayMark";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? "font-semibold text-ink" : "text-ink hover:text-brand";

// Two rows: a thin utility bar, then the main row carrying the wordmark,
// primary nav, and the two CTAs. Everything wraps rather than collapsing
// into a hamburger, so every link stays reachable on a phone.
export function Header() {
  return (
    <header className="border-b border-hairline">
      {/* Row 1: utility bar */}
      <div className="border-b border-hairline bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs text-muted">
          <div className="flex items-center gap-4">
            <Link to="/about#clean-way" className="flex items-center gap-1.5 hover:text-brand">
              <CleanWayMark className="h-3.5 w-3.5" />
              The Clean Way
            </Link>
            <Link to="/help" className="hover:text-brand">
              Need help?
            </Link>

            {/* Other projects — these point at the About page's projects
                section rather than off-site, so nothing here is a dead link
                until the real URLs exist. */}
            <span aria-hidden className="hidden h-3 w-px bg-hairline sm:inline-block" />
            <Link to="/about#projects" className="hover:text-brand">
              PromptWorks
            </Link>
            <Link to="/about#projects" className="hover:text-brand">
              RhinoTrade
            </Link>
          </div>
          <span>Gainesville, FL &amp; Nationwide Shipping</span>
        </div>
      </div>

      {/* Row 2: wordmark, primary nav, CTAs */}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-3 px-4 py-4">
        <Link to="/" className="flex shrink-0 items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded border border-hairline text-[10px] text-muted">
            logo
          </span>
          <span className="text-lg font-bold tracking-tight text-ink">CarlosTechSolutions</span>
        </Link>

        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[15px]">
          <NavLink to="/shop" className={navLinkClass}>
            Shop
          </NavLink>
          <NavLink to="/services" className={navLinkClass}>
            Services
          </NavLink>
          <NavLink to="/about" className={navLinkClass}>
            About
          </NavLink>
          <NavLink to="/contact" className={navLinkClass}>
            Contact
          </NavLink>
          <NavLink to="/help" className={navLinkClass}>
            FAQ
          </NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <Link
            to="/shop"
            className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            Shop inventory
          </Link>
        </div>
      </div>
    </header>
  );
}
