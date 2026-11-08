/**
 * Formats an amount in minor units ("$12", "$12.50"), like the storefront's
 * weekly prices. Without a known currency it prints the plain amount.
 */
export function formatMoney(amount: number, currency: string | undefined): string {
  const fractionDigits = {
    minimumFractionDigits: amount % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  };

  return new Intl.NumberFormat(
    "en-US",
    currency ? { style: "currency", currency, ...fractionDigits } : fractionDigits,
  ).format(amount / 100);
}
