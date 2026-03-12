/**
 * Format a price for display: always 2 decimal places, avoids float noise (e.g. 946.6800000000001 → 946.68).
 * Use for order totals, cart totals, and anywhere money is shown (especially after coupon discounts).
 */
export function formatPrice(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0.00';
  return num.toFixed(2);
}
