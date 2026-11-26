import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Header, type NavItem } from "./Header";
import { HomeMark } from "./HomeMark";
import { useAdminSession } from "../lib/useAdminSession";

// The admin panel's shell. Same header as the shop — same utility bar, same
// NexFix wordmark and logo, same centred nav — with the tabs swapped.
// Sharing the component rather than copying its markup means the two can't
// drift into looking almost-alike, and the grid trick that centres the nav
// only has to be right in one place.
//
// No footer, and the content sits on white rather than the shop's cream, so
// the chrome is familiar while the page underneath is clearly a different
// part of the site.

const ADMIN_NAV: NavItem[] = [
  // `end` because NavLink matches by prefix: without it a link to "/" is
  // "active" on every admin route, and Home would always look selected.
  { to: "/", label: "Home", icon: <HomeMark className="h-4 w-4" />, end: true },
  { to: "/admin/list", label: "List" },
  { to: "/admin/codes", label: "Codes" },
  { to: "/admin/settings", label: "Settings" },
];

export function AdminLayout() {
  const { user, loading } = useAdminSession();
  const location = useLocation();

  // Still asking the server. Render nothing rather than guessing — flashing
  // the panel and then bouncing to /login looks like a bug, and flashing
  // /login at someone who is signed in is worse.
  if (loading) {
    return <div className="min-h-screen bg-white" />;
  }

  if (!user) {
    // `replace` so the back button doesn't land on a panel you can't see,
    // and `state` so signing in returns you to the page you wanted rather
    // than the panel's first tab.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header nav={ADMIN_NAV} />
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
