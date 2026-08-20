import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-20 text-center">
      <h1 className="text-2xl font-semibold text-ink">Page not found</h1>
      <Link to="/" className="mt-3 inline-block text-brand hover:underline">
        Back to homepage
      </Link>
    </div>
  );
}
