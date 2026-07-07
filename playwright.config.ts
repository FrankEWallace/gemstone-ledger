import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests run against the Vite dev server with placeholder Supabase
 * credentials — every covered flow (auth screens, demo mode) is fully
 * client-side, so no real backend is contacted. Flows that need a real
 * Supabase project (signup provisioning, invites, CRUD) are not covered
 * here yet; they'll need a dedicated test project.
 */
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:8080",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:8080",
    reuseExistingServer: !process.env.CI,
    env: {
      // Placeholders keep src/lib/supabase.ts happy without touching prod.
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ?? "https://placeholder.supabase.co",
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY ?? "placeholder-anon-key",
    },
  },
});
