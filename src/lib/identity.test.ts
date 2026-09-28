import { describe, it, expect } from "vitest";
import { TINTS, tintFor, initialsOf } from "./identity";

describe("tintFor", () => {
  it("returns the same tint for the same seed", () => {
    expect(tintFor("customer-42")).toBe(tintFor("customer-42"));
  });

  it("always returns one of the six tints", () => {
    for (const seed of ["", "a", "Rehema Mushi", "0f3c2b1e-9a7d-4c11-8e2f-5b6a7c8d9e0f"]) {
      expect(TINTS).toContain(tintFor(seed));
    }
  });

  it("spreads seeds across more than one tint", () => {
    const seen = new Set(Array.from({ length: 50 }, (_, i) => tintFor(`seed-${i}`)));
    expect(seen.size).toBeGreaterThan(3);
  });
});

describe("initialsOf", () => {
  it("takes the first letter of the first two words", () => {
    expect(initialsOf("Rehema Mushi")).toBe("RM");
    expect(initialsOf("Arusha Gem House")).toBe("AG");
  });

  it("takes the first two letters of a single word", () => {
    expect(initialsOf("merelani")).toBe("ME");
  });

  it("handles extra whitespace and empty names", () => {
    expect(initialsOf("  joseph   laizer ")).toBe("JL");
    expect(initialsOf("")).toBe("?");
    expect(initialsOf(null)).toBe("?");
  });
});
