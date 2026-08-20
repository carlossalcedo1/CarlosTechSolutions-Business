import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getItemById } from "../data/items";
import { PlaceholderImage } from "../components/PlaceholderImage";
import { ConditionBadge } from "../components/ConditionBadge";

export function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const item = id ? getItemById(id) : undefined;
  const [added, setAdded] = useState(false);

  if (!item) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center">
        <p className="text-lg font-medium text-ink">We couldn&apos;t find that item.</p>
        <Link to="/shop" className="mt-2 inline-block text-brand hover:underline">
          Back to shop
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav className="mb-4 text-sm text-muted">
        <Link to="/" className="hover:text-brand">
          Home
        </Link>{" "}
        &gt;{" "}
        <Link to="/shop" className="hover:text-brand">
          Shop
        </Link>{" "}
        &gt;{" "}
        <Link to={`/shop?category=${item.category}`} className="hover:text-brand">
          {item.category}
        </Link>{" "}
        &gt; <span className="text-ink">{item.name}</span>
      </nav>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div>
          <PlaceholderImage label="main image" className="aspect-square w-full rounded" />
          <div className="mt-3 grid grid-cols-4 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <PlaceholderImage key={i} className="aspect-square rounded" />
            ))}
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-semibold text-ink">{item.name}</h1>
          <p className="mt-1 text-2xl font-semibold text-ink">${item.price}</p>
          <div className="mt-2">
            <ConditionBadge condition={item.condition} />
          </div>

          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted">
            {item.specs.map((spec) => (
              <li key={spec}>{spec}</li>
            ))}
          </ul>

          <p className="mt-4 text-sm text-ink">{item.description}</p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => setAdded(true)}
              className="rounded bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark"
            >
              {added ? "Added ✓" : "Add to cart"}
            </button>
            <button
              onClick={() => navigate(`/contact?item=${encodeURIComponent(item.name)}`)}
              className="rounded border border-ink px-5 py-2.5 text-sm font-medium text-ink hover:bg-ink hover:text-white"
            >
              Message seller
            </button>
          </div>

          <p className="mt-4 text-xs text-muted">
            Ships in 3-4 business days · 90-day warranty
            {item.factoryUnlocked && " · Factory unlocked"}
          </p>
        </div>
      </div>
    </div>
  );
}
