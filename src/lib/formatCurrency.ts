/**
 * App-wide currency formatting.
 * Currency is TZS (Tanzanian Shilling, symbol: TSh).
 */

export const CURRENCY_CODE   = "TZS";
export const CURRENCY_SYMBOL = "TSh";

/** How many decimal places to show for compact tiers (0 for ≥100, 1 for ≥10, 2 below) */
function smartDecimals(abs: number, divisor: number): number {
  const v = abs / divisor;
  if (v >= 100) return 0;
  if (v >= 10)  return 1;
  return 2;
}

/** Full format — TSh 1,234 or TSh 1,234.56 */
export function fmtCurrency(n: number, decimals = 0): string {
  return `${CURRENCY_SYMBOL} ${Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

/** Compact format — TSh 1.23B / 12.3M / 123k (preserves sign, supports T/B/M/k) */
export function fmtCompact(n: number): string {
  const abs  = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (abs >= 1_000_000_000_000) return `${sign}${CURRENCY_SYMBOL} ${(abs / 1_000_000_000_000).toFixed(smartDecimals(abs, 1_000_000_000_000))}T`;
  if (abs >= 1_000_000_000)     return `${sign}${CURRENCY_SYMBOL} ${(abs / 1_000_000_000).toFixed(smartDecimals(abs, 1_000_000_000))}B`;
  if (abs >= 1_000_000)         return `${sign}${CURRENCY_SYMBOL} ${(abs / 1_000_000).toFixed(smartDecimals(abs, 1_000_000))}M`;
  if (abs >= 1_000)             return `${sign}${CURRENCY_SYMBOL} ${(abs / 1_000).toFixed(0)}k`;
  return `${sign}${CURRENCY_SYMBOL} ${Math.round(abs).toLocaleString()}`;
}

/**
 * Compact amount without the currency symbol — use for card number display
 * where the symbol is shown separately in a smaller style.
 */
export function fmtCompactNum(n: number): string {
  const abs  = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (abs >= 1_000_000_000_000) return `${sign}${(abs / 1_000_000_000_000).toFixed(smartDecimals(abs, 1_000_000_000_000))}T`;
  if (abs >= 1_000_000_000)     return `${sign}${(abs / 1_000_000_000).toFixed(smartDecimals(abs, 1_000_000_000))}B`;
  if (abs >= 1_000_000)         return `${sign}${(abs / 1_000_000).toFixed(smartDecimals(abs, 1_000_000))}M`;
  if (abs >= 1_000)             return `${sign}${(abs / 1_000).toFixed(0)}k`;
  return `${sign}${Math.round(abs).toLocaleString()}`;
}

/** Chart tick formatter — TSh 1k / TSh 1M / TSh 1B / TSh 1T */
export function fmtTick(v: number): string {
  if (v >= 1_000_000_000_000) return `${CURRENCY_SYMBOL} ${(v / 1_000_000_000_000).toFixed(0)}T`;
  if (v >= 1_000_000_000)     return `${CURRENCY_SYMBOL} ${(v / 1_000_000_000).toFixed(0)}B`;
  if (v >= 1_000_000)         return `${CURRENCY_SYMBOL} ${(v / 1_000_000).toFixed(0)}M`;
  if (v >= 1_000)             return `${CURRENCY_SYMBOL} ${(v / 1_000).toFixed(0)}k`;
  return `${CURRENCY_SYMBOL} ${v}`;
}
