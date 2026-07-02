import { test, expect } from "@playwright/test";

test.describe("login page", () => {
  test("renders the sign-in form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: /Try Demo/ })).toBeVisible();
  });

  test("shows validation errors on empty submit", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Enter a valid email")).toBeVisible();
    await expect(page.getByText("Password must be at least 6 characters")).toBeVisible();
  });

  test("links to forgot password and register", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "Forgot password?" }).click();
    await expect(page).toHaveURL(/\/forgot-password/);

    await page.goto("/login");
    await page.getByRole("link", { name: "Create one" }).click();
    await expect(page).toHaveURL(/\/register/);
  });
});

test.describe("register flow", () => {
  test("step 1 validates before advancing", async ({ page }) => {
    await page.goto("/register");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Enter your full name")).toBeVisible();
    await expect(page.getByText("Enter a valid email")).toBeVisible();
  });

  test("valid step 1 advances to organization step", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("Full name").fill("Test User");
    await page.getByLabel("Work email").fill("test@example.com");
    await page.getByLabel("Password", { exact: true }).fill("password123");
    await page.getByLabel("Confirm password").fill("password123");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByLabel("Organization name")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
  });

  test("mismatched passwords are rejected", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("Full name").fill("Test User");
    await page.getByLabel("Work email").fill("test@example.com");
    await page.getByLabel("Password", { exact: true }).fill("password123");
    await page.getByLabel("Confirm password").fill("different456");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Passwords don't match")).toBeVisible();
  });
});

test.describe("check-email page", () => {
  test("renders standalone (no router state)", async ({ page }) => {
    await page.goto("/check-email");
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to sign in" })).toBeVisible();
  });
});

test.describe("route protection", () => {
  test("unauthenticated visit redirects to login with redirect param", async ({ page }) => {
    await page.goto("/transactions");
    await expect(page).toHaveURL(/\/login\?redirect=%2Ftransactions/);
  });

  test("unknown route shows not-found page, not a crash", async ({ page }) => {
    await page.goto("/definitely-not-a-page");
    // NotFound renders behind auth-independent catch-all
    await expect(page.locator("body")).not.toContainText("Unexpected Application Error");
  });
});
