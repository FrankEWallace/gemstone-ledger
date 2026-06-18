import { describe, it, expect, beforeEach } from "vitest";
import {
  isDemoMode,
  enterDemoMode,
  exitDemoMode,
  DEMO_FLAG,
  DEMO_SITE_ID,
} from "./index";

describe("demo mode", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("is off by default", () => {
    expect(isDemoMode()).toBe(false);
  });

  it("enterDemoMode sets the flag and pins the demo site", () => {
    enterDemoMode();
    expect(isDemoMode()).toBe(true);
    expect(localStorage.getItem(DEMO_FLAG)).toBe("1");
    expect(localStorage.getItem("activeSiteId")).toBe(DEMO_SITE_ID);
  });

  it("exitDemoMode clears the flag and the active site", () => {
    enterDemoMode();
    exitDemoMode();
    expect(isDemoMode()).toBe(false);
    expect(localStorage.getItem(DEMO_FLAG)).toBeNull();
    expect(localStorage.getItem("activeSiteId")).toBeNull();
  });

  it("only treats the exact value '1' as enabled", () => {
    localStorage.setItem(DEMO_FLAG, "true");
    expect(isDemoMode()).toBe(false);
    localStorage.setItem(DEMO_FLAG, "1");
    expect(isDemoMode()).toBe(true);
  });
});
