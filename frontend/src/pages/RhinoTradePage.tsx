// Landing page for a bare /rhinotrade link, kept ready in case that link
// goes out before the subdomain exists. RhinoTrade has no live site yet, so
// the "link" is a disabled placeholder rather than something that routes
// anywhere — swap it for a real <a href> once there's a site to send people to.
export function RhinoTradePage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-semibold text-ink">RhinoTrade</h1>
      <p className="mt-2 text-muted">
        Automated trading, with the data science behind it.
      </p>
      <span
        aria-disabled="true"
        className="mt-8 cursor-not-allowed rounded-full border border-hairline px-7 py-3 text-[15px] font-medium text-muted"
      >
        Coming soon
      </span>
    </div>
  );
}
