/**
 * Formats an amount in minor units ("$12", "$12.50"). Whole amounts drop the
 * cents, as the design shows weekly prices.
 */
export function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: amount % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount / 100);
}
