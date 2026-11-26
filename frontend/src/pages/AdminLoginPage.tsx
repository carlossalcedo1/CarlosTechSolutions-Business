import { Link } from "react-router-dom";

// Placeholder behind the header's admin link. There's no auth yet (see
// lib/useAdminSession.ts), but the link had to land somewhere — without this
// route it falls through to the catch-all and tells the owner his own admin
// panel doesn't exist, which is a worse answer than "not built yet".
export function AdminLoginPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-20 text-center">
      <h1 className="text-2xl font-semibold text-ink">Admin sign-in</h1>
      <p className="mx-auto mt-3 max-w-md text-muted">
        The admin panel hasn&apos;t been built yet. This page is the spot it will live, so the
        link in the header already points somewhere real.
      </p>
      <Link to="/" className="mt-6 inline-block text-brand hover:underline">
        Back to homepage
      </Link>
    </div>
  );
}
