import { describe, it, expect } from "vitest";
import { groupThousands, stripGroups } from "./MoneyInput";

describe("groupThousands", () => {
  it("returns empty for empty input", () => {
    expect(groupThousands("")).toBe("");
  });

  it("groups the integer part in threes", () => {
    expect(groupThousands("6000")).toBe("6,000");
    expect(groupThousands("1000000")).toBe("1,000,000");
    expect(groupThousands("1000000000")).toBe("1,000,000,000");
  });

  it("leaves numbers under 1000 unchanged", () => {
    expect(groupThousands("999")).toBe("999");
  });

  it("strips leading zeros but keeps a lone zero", () => {
    expect(groupThousands("06000000")).toBe("6,000,000");
    expect(groupThousands("0")).toBe("0");
    expect(groupThousands("00")).toBe("0");
    expect(groupThousands("0.5")).toBe("0.5");
  });

  it("accepts number input", () => {
    expect(groupThousands(String(1234567))).toBe("1,234,567");
  });

  it("keeps a decimal part and a trailing dot mid-typing", () => {
    expect(groupThousands("1234.5")).toBe("1,234.5");
    expect(groupThousands("1234.")).toBe("1,234.");
  });

  it("ignores stray separators and collapses extra dots", () => {
    expect(groupThousands("1,234")).toBe("1,234");
    expect(groupThousands("12.34.56")).toBe("12.3456");
  });
});

describe("stripGroups", () => {
  it("removes commas to yield a clean numeric string", () => {
    expect(stripGroups("1,234,567")).toBe("1234567");
    expect(stripGroups("6,000.50")).toBe("6000.50");
  });
});
