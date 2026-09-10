import { Link, NavLink } from "react-router-dom";
import { CleanWayMark } from "./CleanWayMark";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? "font-semibold text-ink" : "text-ink hover:text-brand";

// Two rows: a thin utility bar, then the main row carrying the wordmark
// and primary nav. Everything wraps rather than collapsing into a
// hamburger, so every link stays reachable on a phone.
export function Header() {
  return (
    <header className="border-b border-hairline">
      {/* Row 1: utility bar. Kept deliberately short — PromptWorks and
          RhinoTrade used to live here, but that's too much to fit on a
          phone alongside the wordmark below. They're now a callout above
          the homepage hero instead (see HomePage.tsx). */}
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
          </div>
          <span>Gainesville, FL &amp; Nationwide Shipping</span>
        </div>
      </div>

      {/* Row 2: wordmark left, primary nav centered. No CTA button here
          anymore — "Shop inventory" duplicated the Shop nav link one
          glance away, and dropping it is what makes room for centering
          instead of everything bunching up against the logo.
          Grid, not flex: an `auto` column sizes to its content, so the
          invisible wordmark copy on the right (below) is automatically
          exactly as wide as the real one on the left, and the nav
          (the `1fr` middle column) ends up centered on the *row*, not
          just centered in whatever space happens to be left over. */}
      <div className="mx-auto grid max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-x-8 gap-y-3 px-4 py-4">
        <Link to="/" className="flex shrink-0 items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded border border-hairline text-[10px] text-muted">
            logo
          </span>
          <span className="text-lg font-bold tracking-tight text-ink">CarlosTechSolutions</span>
        </Link>

        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[15px]">
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

        {/* Invisible twin of the logo block, purely to balance the grid —
            see the comment above. Hidden below sm: at that width the row
            is already wrapping, and reserving a matching logo-width slot
            would just steal space the nav needs to wrap into. */}
        <div aria-hidden className="hidden shrink-0 items-center gap-2 opacity-0 sm:flex">
          <span className="flex h-9 w-9 items-center justify-center rounded border border-hairline text-[10px]">
            logo
          </span>
          <span className="text-lg font-bold tracking-tight">CarlosTechSolutions</span>
        </div>
      </div>
    </header>
  );
}
