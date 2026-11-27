import { type ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { MissionMark } from "./MissionMark";
import { PersonMark } from "./PersonMark";
import { Logo } from "./Logo";
import { useAdminSession } from "../lib/useAdminSession";

export type NavItem = {
  to: string;
  label: string;
  icon?: ReactNode;
  /** NavLink matches by prefix, so a link to "/" is "active" on every page
   *  unless this is set. Only the admin nav's Home tab needs it. */
  end?: boolean;
};

const SHOP_NAV: NavItem[] = [
  { to: "/shop", label: "Shop" },
  { to: "/services", label: "Service" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
  { to: "/help", label: "FAQ" },
];

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    "inline-flex items-center gap-1.5",
    isActive ? "font-semibold text-ink" : "text-ink hover:text-brand",
  ].join(" ");

// Two rows: a thin utility bar, then the main row carrying the wordmark
// and primary nav. Everything wraps rather than collapsing into a
// hamburger, so every link stays reachable on a phone.
//
// The admin panel renders this same component with a different `nav`, so
// both sides of the site share one header rather than two that look alike
// until someone changes one. Everything else — the utility bar, the
// wordmark, the grid trick that centres the nav — is identical by
// construction, which is the point.
export function Header({ nav = SHOP_NAV }: { nav?: NavItem[] }) {
  const { user, loading, signOut } = useAdminSession();

  return (
    <header className="border-b border-hairline">
      {/* Row 1: utility bar. Kept deliberately short — PromptWorks and
          RhinoTrade used to live here, but that's too much to fit on a
          phone alongside the wordmark below. They're now a callout above
          the homepage hero instead (see HomePage.tsx). */}
      <div className="border-b border-hairline bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs text-muted">
          <div className="flex items-center gap-4">
            <Link to="/about#our-mission" className="flex items-center gap-1.5 hover:text-brand">
              <MissionMark className="h-3.5 w-3.5" />
              Our Mission
            </Link>
            <Link to="/help" className="hover:text-brand">
              <span className="sm:hidden">Help?</span>
              <span className="hidden sm:inline">Need help?</span>
            </Link>
          </div>
          {/* Right-hand group mirrors the left one — same flex, same gap,
              same icon-then-label shape — so the bar reads as one row of
              utility links rather than a label with a button bolted on.
              The admin link sits outboard of the location text because
              account controls are the last thing in a utility bar
              everywhere else on the web, and that's the muscle memory. */}
          <div className="flex items-center gap-4">
            {/* Everything after the city drops below sm. It used to be just
                "Nationwide" that went, which was enough when this span had
                the right-hand side to itself; sharing the row with the admin
                link, the whole tail has to go or the bar wraps. */}
            {/* Signed in, the city goes too on a phone. Adding "Sign out"
                to this row is what tips it onto a second line, and between
                a location and a control the admin actually uses, the
                location is the one that can wait for a wider screen. */}
            <span className={`whitespace-nowrap ${user ? "hidden sm:inline" : ""}`}>
              Gainesville, FL
              <span className="hidden sm:inline"> &amp; Nationwide Shipping</span>
            </span>

            {/* Signed in, the greeting is the way into the panel. /login
                would redirect there anyway, but going straight avoids the
                visible hop.
                Negative margin cancels the padding, so the hit area grows to
                ~26px for the icon-only phone state without the link taking
                up any more room in the row than its text does. */}
            <Link
              to={user ? "/admin" : "/login"}
              className="-m-1.5 flex items-center gap-1.5 p-1.5 hover:text-brand"
            >
              {/* Nothing at all until the first /api/admin/me answers.
                  Rendering the signed-out branch while loading makes the bar
                  flash "Log in" and then correct itself on every page load,
                  which looks like a glitch; an empty slot of the same height
                  doesn't move anything when it fills. */}
              {loading ? (
                <span className="inline-block h-3.5 w-3.5" aria-hidden />
              ) : user ? (
                <span className="whitespace-nowrap">
                  {/* Just the name on a phone — "Hello, " is the first thing
                      worth losing when the row runs out of room. */}
                  <span className="hidden sm:inline">Hello, </span>
                  {user.username}
                </span>
              ) : (
                <>
                  <PersonMark className="h-3.5 w-3.5" />
                  {/* Label drops below sm, same trick as "Need help?" above:
                      the icon alone is still a 14px-plus tap target, and the
                      row went to two lines on a phone with it in. */}
                  <span className="hidden sm:inline">Log in</span>
                </>
              )}
            </Link>

            {/* Only once there's something to sign out of. It lives here
                rather than inside the panel so it's reachable from the shop
                too — you can end a session without first navigating back
                into the admin side to find the button. */}
            {user && (
              <button
                type="button"
                onClick={() => void signOut()}
                className="-m-1.5 p-1.5 whitespace-nowrap hover:text-brand"
              >
                Sign out
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: wordmark left, primary nav centered. No CTA button here
          anymore — "Shop inventory" duplicated the Shop nav link one
          glance away, and dropping it is what makes room for centering
          instead of everything bunching up against the logo.
          Stacked below sm: five nav links never fit next to the wordmark
          on a phone, and squeezing them into the leftover space (rather
          than giving nav the full row on its own line) was the actual
          mobile bug. flex-col by default, switching to the 3-column grid
          at sm and up — see the classes below.
          On sm+, grid (not flex) so the invisible wordmark copy on the
          right is automatically exactly as wide as the real one on the
          left, and the nav (the `1fr` middle column) ends up centered on
          the *row*, not just centered in whatever space is left over. */}
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-4 sm:grid sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-x-8 sm:gap-y-3">
        <Link to="/" className="flex shrink-0 items-center gap-2">
          {/* The NexFix N with the wrench knocked out of its right stroke,
              shading and all — see Logo.tsx for why it's a raster here and
              a vector in the browser tab. Masters live in /brand. */}
          <Logo />
          <span className="text-2xl font-bold tracking-tight text-ink">NexFix</span>
        </Link>

        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[15px]">
          {nav.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Invisible twin of the logo block, purely to balance the grid —
            see the comment above. Its mark size and type scale have to track
            the real one exactly, or the middle column stops being centred. Hidden below sm: at that width the row
            is already wrapping, and reserving a matching logo-width slot
            would just steal space the nav needs to wrap into. */}
        <div aria-hidden className="hidden shrink-0 items-center gap-2 opacity-0 sm:flex">
          <Logo />
          <span className="text-2xl font-bold tracking-tight">NexFix</span>
        </div>
      </div>
    </header>
  );
}
