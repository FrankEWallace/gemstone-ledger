/**
 * Backend Provider Configuration
 *
 * The active backend is determined at DEPLOY TIME via environment variables,
 * not at runtime by end users. This prevents any user — even an admin — from
 * redirecting API calls to an arbitrary server through localStorage manipulation.
 *
 * Environment variables (set in .env / Vercel project settings):
 *   VITE_BACKEND_PROVIDER  "supabase" | "rest"   (default: "supabase")
 *   VITE_REST_BASE_URL     Base URL of the Laravel REST API when using "rest"
 *                          e.g. https://api.yoursite.com/api/v1
 *
 * MIGRATION PATH:
 * ─────────────────────────────────────────────────────────────────────────
 * 1. Deploy the Laravel REST API (see mining-os-api/DEPLOY.md).
 * 2. Set VITE_BACKEND_PROVIDER=rest and VITE_REST_BASE_URL=<url> in your
 *    deployment environment and rebuild/redeploy.
 * 3. Each service file (src/services/*.service.ts) needs its Supabase calls
 *    replaced with the corresponding REST client calls.
 * ─────────────────────────────────────────────────────────────────────────
 */

export type BackendProvider = "supabase" | "rest";

export interface BackendConfig {
  provider: BackendProvider;
  restBaseUrl: string;
}

// ── Cleanup: remove any lingering localStorage config from the old system ──
// This runs once on module load. Users who had the old localStorage toggle
// set to "rest" would otherwise silently lose their session with no explanation.
if (typeof localStorage !== "undefined") {
  const OLD_KEY = "fwmining_backend_provider";
  if (localStorage.getItem(OLD_KEY)) {
    console.warn(
      "[BackendConfig] Removed stale localStorage backend config. " +
      "Backend selection is now controlled by environment variables (VITE_BACKEND_PROVIDER)."
    );
    localStorage.removeItem(OLD_KEY);
  }
}

// ── Read config from env (resolved at build time by Vite) ─────────────────

const _provider = (import.meta.env.VITE_BACKEND_PROVIDER ?? "supabase") as BackendProvider;
const _restBaseUrl = (import.meta.env.VITE_REST_BASE_URL ?? "").replace(/\/$/, "");

if (_provider === "rest" && !_restBaseUrl) {
  console.error(
    "[BackendConfig] VITE_BACKEND_PROVIDER=rest but VITE_REST_BASE_URL is not set. " +
    "All REST API calls will fail."
  );
}

const _config: BackendConfig = {
  provider: _provider,
  restBaseUrl: _restBaseUrl,
};

// ── Public API ─────────────────────────────────────────────────────────────

export function getBackendConfig(): BackendConfig {
  return _config;
}

export function getActiveProvider(): BackendProvider {
  return _config.provider;
}

export function isSupabaseActive(): boolean {
  return _config.provider === "supabase";
}

export function isRestActive(): boolean {
  return _config.provider === "rest";
}
