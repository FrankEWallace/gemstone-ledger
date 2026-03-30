/**
 * Backend Provider Configuration
 *
 * Controls which backend is active: Supabase (default) or a custom REST API
 * (e.g. a PHP application hosted on cPanel/shared hosting).
 *
 * Config is stored in localStorage so it survives page reloads without
 * requiring a server round-trip. Only org admins can change it via Settings.
 *
 * MIGRATION PATH:
 * ─────────────────────────────────────────────────────────────────────────
 * 1. Build the PHP REST API on cPanel (see src/lib/providers/rest/client.ts
 *    for the full endpoint contract).
 * 2. In Settings → Backend Provider, enter the base URL and test connection.
 * 3. Flip the toggle to "REST API" — the page reloads and all service calls
 *    will route through src/lib/providers/rest/client.ts.
 * 4. Each service file (src/services/*.service.ts) needs its Supabase calls
 *    replaced with the corresponding REST client calls. The REST client stubs
 *    act as a 1:1 map to guide that work.
 * ─────────────────────────────────────────────────────────────────────────
 */

const STORAGE_KEY = "fwmining_backend_provider";

export type BackendProvider = "supabase" | "rest";

export interface BackendConfig {
  provider: BackendProvider;
  /**
   * Base URL of the Laravel REST API.
   * e.g. https://yoursite.com/api/v1
   * The Laravel backend lives at /Applications/MAMP/htdocs/mining-os-api
   * and exposes all routes under /api/v1.
   */
  restBaseUrl: string;
  /** ISO timestamp of when the REST provider was last activated */
  restActivatedAt?: string;
}

const DEFAULT_CONFIG: BackendConfig = {
  provider: "supabase",
  restBaseUrl: "",
};

export function getBackendConfig(): BackendConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function setBackendConfig(config: BackendConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function getActiveProvider(): BackendProvider {
  return getBackendConfig().provider;
}

export function isSupabaseActive(): boolean {
  return getBackendConfig().provider === "supabase";
}

export function isRestActive(): boolean {
  return getBackendConfig().provider === "rest";
}

/**
 * Switches the active backend and reloads the app so all services
 * pick up the new config cleanly.
 */
export function activateProvider(config: BackendConfig): void {
  setBackendConfig(config);
  window.location.reload();
}
