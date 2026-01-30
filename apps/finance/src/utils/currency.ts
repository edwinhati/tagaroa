/**
 * Format currency with full precision
 */
export const formatCurrency = (amount: number, currency: string = "IDR") => {
  return new Intl.NumberFormat(currency === "IDR" ? "id-ID" : "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: currency === "IDR" ? 0 : 2,
    maximumFractionDigits: currency === "IDR" ? 0 : 2,
  }).format(amount);
};

/**
 * Format currency in compact notation for large numbers
 * e.g., 1.500.000.000 → Rp 1,5 M (miliar)
 *       15.000.000 → Rp 15 jt (juta)
 */
export const formatCurrencyCompact = (
  amount: number,
  currency: string = "IDR",
) => {
  const absAmount = Math.abs(amount);
  const locale = currency === "IDR" ? "id-ID" : "en-US";

  // For IDR, use English abbreviations
  if (currency === "IDR") {
    if (absAmount >= 1_000_000_000_000) {
      // Trillion
      const value = amount / 1_000_000_000_000;
      return `Rp ${formatNumber(value, locale)}T`;
    }
    if (absAmount >= 1_000_000_000) {
      // Billion
      const value = amount / 1_000_000_000;
      return `Rp ${formatNumber(value, locale)}B`;
    }
    if (absAmount >= 1_000_000) {
      // Million
      const value = amount / 1_000_000;
      return `Rp ${formatNumber(value, locale)}M`;
    }
    if (absAmount >= 1_000) {
      // Thousand
      const value = amount / 1_000;
      return `Rp ${formatNumber(value, locale)}K`;
    }
    return `Rp ${amount.toLocaleString(locale)}`;
  }

  // For other currencies, use standard compact notation
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    notation: "compact",
    compactDisplay: "short",
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(amount);
};

/**
 * Smart currency format - uses compact for large numbers, full for smaller
 * Threshold: 10 million for compaction
 */
export const formatCurrencySmart = (
  amount: number,
  currency: string = "IDR",
  compactThreshold: number = 10_000_000,
) => {
  const absAmount = Math.abs(amount);

  if (absAmount >= compactThreshold) {
    return formatCurrencyCompact(amount, currency);
  }

  return formatCurrency(amount, currency);
};

/**
 * Helper to format number with appropriate decimal places
 */
function formatNumber(value: number, locale: string): string {
  // If it's a whole number, don't show decimals
  if (Number.isInteger(value)) {
    return value.toLocaleString(locale);
  }
  // Otherwise show 1 decimal place
  return value.toLocaleString(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}
