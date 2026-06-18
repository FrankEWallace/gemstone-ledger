import { describe, it, expect } from "vitest";
import {
  fmtCurrency,
  fmtCompact,
  fmtCompactNum,
  fmtTick,
  CURRENCY_SYMBOL,
} from "./formatCurrency";

describe("fmtCurrency", () => {
  it("formats whole numbers with thousands separators", () => {
    expect(fmtCurrency(1234)).toBe(`${CURRENCY_SYMBOL} 1,234`);
    expect(fmtCurrency(1000000)).toBe(`${CURRENCY_SYMBOL} 1,000,000`);
  });

  it("respects the decimals argument", () => {
    expect(fmtCurrency(1234.56, 2)).toBe(`${CURRENCY_SYMBOL} 1,234.56`);
    expect(fmtCurrency(1234.5, 2)).toBe(`${CURRENCY_SYMBOL} 1,234.50`);
  });

  it("uses the absolute value (drops the sign)", () => {
    expect(fmtCurrency(-1234)).toBe(`${CURRENCY_SYMBOL} 1,234`);
  });

  it("formats zero", () => {
    expect(fmtCurrency(0)).toBe(`${CURRENCY_SYMBOL} 0`);
  });
});

describe("fmtCompact", () => {
  it("formats sub-thousand values with rounding", () => {
    expect(fmtCompact(0)).toBe(`${CURRENCY_SYMBOL} 0`);
    expect(fmtCompact(999)).toBe(`${CURRENCY_SYMBOL} 999`);
    expect(fmtCompact(999.4)).toBe(`${CURRENCY_SYMBOL} 999`);
  });

  it("formats thousands with a k suffix and no decimals", () => {
    expect(fmtCompact(1000)).toBe(`${CURRENCY_SYMBOL} 1k`);
    expect(fmtCompact(12_500)).toBe(`${CURRENCY_SYMBOL} 13k`);
  });

  it("formats millions with smart decimals", () => {
    // >= 100 in the tier -> 0 decimals
    expect(fmtCompact(123_000_000)).toBe(`${CURRENCY_SYMBOL} 123M`);
    // >= 10 -> 1 decimal
    expect(fmtCompact(12_300_000)).toBe(`${CURRENCY_SYMBOL} 12.3M`);
    // < 10 -> 2 decimals
    expect(fmtCompact(1_230_000)).toBe(`${CURRENCY_SYMBOL} 1.23M`);
  });

  it("formats billions and trillions", () => {
    expect(fmtCompact(1_230_000_000)).toBe(`${CURRENCY_SYMBOL} 1.23B`);
    expect(fmtCompact(1_230_000_000_000)).toBe(`${CURRENCY_SYMBOL} 1.23T`);
  });

  it("preserves a negative sign with the unicode minus", () => {
    expect(fmtCompact(-12_300_000)).toBe(`−${CURRENCY_SYMBOL} 12.3M`);
    expect(fmtCompact(-500)).toBe(`−${CURRENCY_SYMBOL} 500`);
  });
});

describe("fmtCompactNum", () => {
  it("omits the currency symbol but keeps the tier suffix", () => {
    expect(fmtCompactNum(1_230_000)).toBe("1.23M");
    expect(fmtCompactNum(12_500)).toBe("13k");
    expect(fmtCompactNum(999)).toBe("999");
  });

  it("preserves the negative sign", () => {
    expect(fmtCompactNum(-1_230_000)).toBe("−1.23M");
  });
});

describe("fmtTick", () => {
  it("formats axis ticks across tiers with no decimals", () => {
    expect(fmtTick(500)).toBe(`${CURRENCY_SYMBOL} 500`);
    expect(fmtTick(2000)).toBe(`${CURRENCY_SYMBOL} 2k`);
    expect(fmtTick(3_000_000)).toBe(`${CURRENCY_SYMBOL} 3M`);
    expect(fmtTick(4_000_000_000)).toBe(`${CURRENCY_SYMBOL} 4B`);
    expect(fmtTick(5_000_000_000_000)).toBe(`${CURRENCY_SYMBOL} 5T`);
  });
});
