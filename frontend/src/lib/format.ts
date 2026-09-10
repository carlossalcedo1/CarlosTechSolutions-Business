/**
 * Prices are stored as integer cents (see backend/app/models.py). Formatting
 * happens here and nowhere else, so a price can't be rendered one way on a
 * card and another way on the product page.
 */
export function formatPrice(cents: number): string {
  const dollars = cents / 100;
  return cents % 100 === 0 ? `$${dollars.toFixed(0)}` : `$${dollars.toFixed(2)}`;
}
