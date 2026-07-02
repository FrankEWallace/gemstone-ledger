import type { Page } from "@playwright/test";

// Matches DEMO_FLAG / DEMO_SITE_ID in src/lib/demo/index.ts
const DEMO_FLAG = "fw-demo-mode";
const DEMO_SITE_ID = "demo-site-00000000";

/**
 * Puts the app in demo mode before any page script runs — same effect as
 * clicking "Try Demo" on the login page, without going through the UI.
 * Demo mode bypasses auth and serves local sample data, so these tests
 * never touch a real backend.
 */
export async function enterDemoMode(page: Page): Promise<void> {
  await page.addInitScript(
    ([flag, siteId]) => {
      localStorage.setItem(flag, "1");
      localStorage.setItem("activeSiteId", siteId);
    },
    [DEMO_FLAG, DEMO_SITE_ID],
  );
}
