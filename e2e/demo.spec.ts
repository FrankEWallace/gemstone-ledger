import { test, expect } from "@playwright/test";
import { enterDemoMode } from "./helpers";

/**
 * Demo mode is a fully local sandbox: auth is bypassed and every service
 * returns sample data, so these specs exercise the real app shell, router,
 * sidebar, and page rendering without any backend.
 */
test.describe("demo mode", () => {
  test("entering via the login button lands on the dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /Try Demo/ }).click();
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });

  test.describe("with demo session", () => {
    test.beforeEach(async ({ page }) => {
      await enterDemoMode(page);
    });

    test("dashboard shows the demo site", async ({ page }) => {
      await page.goto("/");
      await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
      await expect(page.getByText("North Star Mine").first()).toBeVisible();
    });

    test("inventory lists demo stock", async ({ page }) => {
      await page.goto("/inventory");
      await expect(page.getByText("Safety Helmets").first()).toBeVisible();
    });

    test("transactions page renders demo data", async ({ page }) => {
      await page.goto("/transactions");
      await expect(page.getByRole("heading", { name: /Transactions/ })).toBeVisible();
      // At least one data row rendered from DEMO_TRANSACTIONS
      await expect(page.locator("table tbody tr").first()).toBeVisible();
    });

    test("team page lists demo workers", async ({ page }) => {
      await page.goto("/team");
      await expect(page.getByText("Sarah Mitchell").first()).toBeVisible();
    });

    test("campaigns module is routed and in the sidebar", async ({ page }) => {
      await page.goto("/");
      await page.getByRole("link", { name: "Campaigns" }).click();
      await expect(page).toHaveURL(/\/campaigns/);
      await expect(page.getByText("Q1 2026 Safety Drive")).toBeVisible();
    });

    test("system settings shows module configuration incl. Campaigns", async ({ page }) => {
      await page.goto("/settings/system");
      await expect(page.getByText("Module Configuration")).toBeVisible();
      await expect(page.getByText("Org-wide operational campaigns targeted at specific sites")).toBeVisible();
    });

    test("navigating across modules never hits the route error boundary", async ({ page }) => {
      for (const path of ["/", "/inventory", "/reports", "/messages", "/equipment", "/safety", "/production", "/documents"]) {
        await page.goto(path);
        await expect(page.locator("body")).not.toContainText("Something went wrong");
      }
    });
  });
});
