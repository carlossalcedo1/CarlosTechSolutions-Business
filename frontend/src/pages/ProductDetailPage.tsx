import { Link, useParams } from "react-router-dom";
import { getItemById } from "../data/items";
import { ProductView } from "../components/ProductView";
import { checkout } from "../lib/api";
import { useSoldItemIds } from "../lib/useSoldItemIds";

export function ProductDetailPage() {
  const { id } = useParams();
  const item = id ? getItemById(id) : undefined;
  const soldIds = useSoldItemIds();
  const isSold = !!item && soldIds.has(item.id);

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

      <ProductView key={item.id} item={item} isSold={isSold} startCheckout={() => checkout(item.id)} />
    </div>
  );
}
