import { NavLink, Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { HomeMark } from "./HomeMark";
import { PersonMark } from "./PersonMark";
import { useAdminSession } from "../lib/useAdminSession";

// The admin panel's shell. Deliberately not the shop's Layout: no shop
// header, no footer, no cream. White and plain, so there's never a moment
// of doubt about which side of the site you're looking at.

const tabs = [
  { to: "/admin/list", label: "List" },
  { to: "/admin/codes", label: "Codes" },
  { to: "/admin/settings", label: "Settings" },
];

const tabClass = ({ isActive }: { isActive: boolean }) =>
  [
    "rounded-full px-4 py-1.5 text-sm font-medium transition",
    isActive ? "bg-ink text-white" : "text-ink hover:bg-black/5",
  ].join(" ");

export function AdminLayout() {
  const { user, loading, signOut } = useAdminSession();
  const location = useLocation();

  // Still asking the server. Render the frame but nothing inside it —
  // flashing the panel and then bouncing to /login looks like a bug, and
  // flashing /login for someone who is signed in is worse.
  if (loading) {
    return <div className="min-h-screen bg-white" />;
  }

  if (!user) {
    // `replace` so the back button doesn't land on a panel you can't see,
    // and `state` so signing in can return you to the page you wanted.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="border-b border-hairline">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
          {/* Home leaves the panel entirely — it's a Link to the shop, not
              an admin tab, so it deliberately doesn't take the active
              treatment the others do. */}
          <Link
            to="/"
            className="flex items-center gap-2 text-sm font-medium text-ink hover:text-brand"
          >
            <HomeMark className="h-4 w-4" />
            Home
          </Link>

          <nav className="flex flex-wrap items-center gap-1">
            {tabs.map((tab) => (
              <NavLink key={tab.to} to={tab.to} className={tabClass}>
                {tab.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <PersonMark className="h-3.5 w-3.5" />
              {user.username}
            </span>
            <button
              type="button"
              onClick={() => void signOut()}
              className="hover:text-brand"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        <Outlet />
      </main>
    </div>
  );
}

/** Shared heading block, so the three pages can't drift apart. */
export function AdminPageHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="border-b border-hairline pb-5">
      <h1 className="text-2xl font-semibold text-ink">{title}</h1>
      <p className="mt-1.5 max-w-2xl text-sm text-muted">{description}</p>
    </div>
  );
}

/**
 * Placeholder for a panel section that has its shell but not its contents.
 *
 * Says plainly that it isn't built rather than showing an empty table that
 * reads as "you have no inventory" — which, on a page whose whole job is
 * showing inventory, is a genuinely misleading thing to put on screen.
 */
export function AdminEmptyState({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-8 rounded-2xl border border-dashed border-hairline px-6 py-12 text-center">
      <p className="font-medium text-ink">{title}</p>
      <div className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
        {children}
      </div>
    </div>
  );
}
