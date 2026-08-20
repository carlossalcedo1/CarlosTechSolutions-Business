import { useState, type FormEvent } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { CATEGORIES } from "../lib/constants";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? "font-semibold text-ink" : "text-ink hover:text-brand";

export function Header() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    navigate(trimmed ? `/shop?q=${encodeURIComponent(trimmed)}` : "/shop");
  }

  return (
    <header className="border-b border-hairline">
      {/* Row 1: utility bar */}
      <div className="border-b border-hairline bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs text-muted">
          <div className="flex items-center gap-4">
            <Link to="/about#clean-way" className="hover:text-brand">
              The Clean Way
            </Link>
            <Link to="/help" className="hover:text-brand">
              Need help?
            </Link>
            <Link to="/contact" className="hover:text-brand">
              For business
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <span>Gainesville and Miami, FL</span>
            <span>English | Español</span>
          </div>
        </div>
      </div>

      {/* Row 2: main row — logo, search, sell CTA, account */}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <span className="flex h-9 w-9 items-center justify-center rounded border border-hairline text-[10px] text-muted">
            logo
          </span>
          <span className="text-lg font-semibold text-ink">Carlos Tech Solutions</span>
        </Link>

        <form onSubmit={handleSearch} className="min-w-[200px] flex-1">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for iPhone, MacBook, Dell..."
            className="w-full rounded border border-hairline bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
          />
        </form>

        <Link
          to="/sell"
          className="shrink-0 rounded border border-ink px-4 py-2 text-sm font-medium text-ink hover:bg-ink hover:text-white"
        >
          Sell your device
        </Link>

        <span
          title="Account (coming soon)"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hairline text-muted"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.5-7 8-7s8 3 8 7" />
          </svg>
        </span>
      </div>

      {/* Row 3: nav row — primary links + quiet category list */}
      <div className="border-t border-hairline">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
          <nav className="flex items-center gap-5">
            <NavLink to="/shop" className={navLinkClass}>
              Shop
            </NavLink>
            <NavLink to="/about" className={navLinkClass}>
              About
            </NavLink>
            <NavLink to="/contact" className={navLinkClass}>
              Contact
            </NavLink>
          </nav>
          <nav className="flex flex-wrap items-center gap-1 text-muted">
            {CATEGORIES.map((category, i) => (
              <span key={category} className="flex items-center gap-1">
                <Link to={`/shop?category=${encodeURIComponent(category)}`} className="hover:text-brand">
                  {category}
                </Link>
                {i < CATEGORIES.length - 1 && <span className="px-1">·</span>}
              </span>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
