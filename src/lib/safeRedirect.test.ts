import { describe, it, expect } from "vitest";
import { safeRedirect } from "./safeRedirect";

describe("safeRedirect", () => {
  it("keeps same-origin paths with query and hash", () => {
    expect(safeRedirect("/reports?from=2026-01-01#top")).toBe("/reports?from=2026-01-01#top");
  });

  it("falls back to / when missing", () => {
    expect(safeRedirect(null)).toBe("/");
    expect(safeRedirect("")).toBe("/");
  });

  it("rejects other origins", () => {
    for (const raw of [
      "https://evil.example",
      "//evil.example/login",
      "/\\evil.example",
      "\\\\evil.example",
      "javascript:alert(1)",
      "http://evil.example@" + window.location.host,
    ]) {
      expect(safeRedirect(raw)).toBe("/");
    }
  });

  it("accepts an absolute URL on this origin", () => {
    expect(safeRedirect(`${window.location.origin}/inventory`)).toBe("/inventory");
  });
});
