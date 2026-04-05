/**
 * App-wide currency formatting.
 * Currency is TZS (Tanzanian Shilling, symbol: TSh).
 */

export const CURRENCY_CODE   = "TZS";
export const CURRENCY_SYMBOL = "TSh";

/** Full format — TSh 1,234 or TSh 1,234.56 */
export function fmtCurrency(n: number, decimals = 0): string {
  return `${CURRENCY_SYMBOL} ${Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

/** Compact format — TSh 1.2k / TSh 1.2M (preserves sign) */
export function fmtCompact(n: number): string {
  const abs  = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}${CURRENCY_SYMBOL} ${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)     return `${sign}${CURRENCY_SYMBOL} ${(abs / 1_000).toFixed(0)}k`;
  return `${sign}${CURRENCY_SYMBOL} ${Math.round(abs).toLocaleString()}`;
}

/** Chart tick formatter — TSh 1k / TSh 1M */
export function fmtTick(v: number): string {
  if (v >= 1_000_000) return `${CURRENCY_SYMBOL} ${(v / 1_000_000).toFixed(0)}M`;
  if (v >= 1_000)     return `${CURRENCY_SYMBOL} ${(v / 1_000).toFixed(0)}k`;
  return `${CURRENCY_SYMBOL} ${v}`;
}
