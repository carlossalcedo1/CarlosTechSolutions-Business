import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { articles, type Article } from "../data/articles";

const CATEGORIES: Article["category"][] = [
  "Orders",
  "Shipping",
  "Returns",
  "Trade-in",
  "Device unlocking",
];

export function HelpCenterPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Article["category"] | null>(null);

  const results = useMemo(() => {
    return articles.filter((article) => {
      if (category && article.category !== category) return false;
      if (!query) return true;
      const haystack = `${article.title} ${article.body} ${article.tags.join(" ")}`.toLowerCase();
      return haystack.includes(query.toLowerCase());
    });
  }, [query, category]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <nav className="mb-4 text-sm text-muted">
        <Link to="/" className="hover:text-brand">
          Home
        </Link>{" "}
        &gt; <span className="text-ink">Help center</span>
      </nav>

      {/* Work-in-progress notice — remove once the help content is settled. */}
      <div className="mb-8 rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-center text-sm text-red-700">
        This part of the website is currently being worked on, please{" "}
        <Link to="/contact" className="font-medium underline underline-offset-2">
          reach out to us
        </Link>{" "}
        with any questions.
      </div>

      <div className="text-center">
        <h1 className="text-2xl font-semibold text-ink">Need help? We got you.</h1>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search our FAQ articles"
          className="mx-auto mt-4 block w-full max-w-lg rounded border border-hairline px-3 py-2 text-sm"
        />

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(category === c ? null : c)}
              className={`rounded-full border px-4 py-1.5 text-sm ${
                category === c ? "border-ink bg-ink text-white" : "border-hairline text-ink hover:border-ink"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 space-y-3">
        {results.length > 0 ? (
          results.map((article) => (
            <div key={article.slug} className="rounded border border-hairline p-4">
              <p className="font-medium text-ink">{article.title}</p>
              <p className="mt-1 text-sm text-muted">{article.body}</p>
              <p className="mt-2 text-xs text-muted">{article.category}</p>
            </div>
          ))
        ) : (
          <p className="text-center text-muted">No articles match — try a different search.</p>
        )}
      </div>

      <p className="mt-8 text-center text-sm text-muted">
        Still need more help?{" "}
        <Link to="/contact" className="font-medium text-brand hover:underline">
          Message us here
        </Link>
      </p>
    </div>
  );
}
