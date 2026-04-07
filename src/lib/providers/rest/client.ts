/**
 * REST API Client — cPanel / Custom Backend
 *
 * This file is the bridge between the app's services and a PHP REST API
 * hosted on cPanel (or any standard web host).
 *
 * STATUS: INACTIVE STUB
 * ─────────────────────────────────────────────────────────────────────────────
 * This client is loaded only when the backend provider is set to "rest" in
 * Settings → Backend Provider. By default Supabase is active.
 *
 * HOW TO USE:
 * 1. Deploy the PHP API on cPanel (see endpoint contract below).
 * 2. Configure the base URL in Settings → Backend Provider.
 * 3. In each src/services/*.service.ts, import restGet/restPost/restPut/restDel
 *    and swap out the Supabase calls using the mapping comments below.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * PHP ENDPOINT CONTRACT
 * ─────────────────────────────────────────────────────────────────────────────
 * All endpoints expect/return JSON. Auth via Bearer token in Authorization header.
 * Standard response envelope: { data: T, error: string|null }
 *
 * Auth
 *   POST   /auth/login                { email, password }  → { token, user, org, sites }
 *   POST   /auth/register             { email, password, org_name, full_name }
 *   POST   /auth/logout
 *   POST   /auth/forgot-password      { email }
 *   GET    /auth/me                   → { user, profile, org, sites_with_roles[] }
 *
 * Inventory
 *   GET    /inventory?site_id=&q=&category=&page=&limit=
 *   POST   /inventory                 { site_id, name, category, sku, quantity, unit_cost, reorder_level, supplier_id }
 *   PUT    /inventory/:id             { ...fields }
 *   DELETE /inventory/:id
 *   GET    /inventory/categories?site_id=
 *   GET    /inventory/consumption?site_id=    → { item_id: rate_per_day }
 *
 * Transactions
 *   GET    /transactions?site_id=&type=&status=&from=&to=&page=&limit=
 *   POST   /transactions              { site_id, reference_no, description, category, type, status, qty, unit_price }
 *   PUT    /transactions/:id
 *   DELETE /transactions/:id
 *   GET    /transactions/export?site_id=...   → CSV file download
 *
 * Suppliers
 *   GET    /suppliers?org_id=
 *   POST   /suppliers                 { org_id, name, contact, email, status }
 *   PUT    /suppliers/:id
 *   DELETE /suppliers/:id
 *
 * Channels
 *   GET    /channels?org_id=
 *   POST   /channels                 { org_id, name, type }
 *   PUT    /channels/:id
 *   DELETE /channels/:id
 *
 * Orders
 *   GET    /orders?site_id=&status=
 *   POST   /orders                   { site_id, supplier_id, channel_id, items[{inventory_item_id, qty, unit_price}] }
 *   PUT    /orders/:id/status        { status }  (on "received" → auto-update inventory)
 *   DELETE /orders/:id
 *   GET    /orders/:id/items
 *
 * Team / Workers
 *   GET    /workers?site_id=
 *   POST   /workers                  { site_id, full_name, position, department, status }
 *   PUT    /workers/:id
 *   DELETE /workers/:id
 *   GET    /shift-records?site_id=&worker_id=&from=&to=
 *   POST   /shift-records            { worker_id, site_id, shift_date, hours_worked, output_metric }
 *
 * Messages
 *   GET    /messages?site_id=&channel=
 *   POST   /messages                 { site_id, content, channel }
 *   (Realtime: poll GET /messages?site_id=&after=<timestamp> every 5s, or use SSE)
 *
 * Campaigns
 *   GET    /campaigns?org_id=
 *   POST   /campaigns                { org_id, title, status, start_date, end_date, target_sites[] }
 *   PUT    /campaigns/:id
 *   DELETE /campaigns/:id
 *
 * Reports
 *   GET    /reports/production?site_id=&from=&to=&period=day|week|month
 *   GET    /reports/expenses?site_id=&from=&to=
 *   GET    /reports/export?site_id=&type=production|expenses&format=csv|pdf
 *
 * Notifications
 *   GET    /notifications?user_id=&read=false
 *   POST   /notifications/:id/read
 *   POST   /notifications/read-all
 *
 * Roles & Users
 *   GET    /org-users?org_id=
 *   POST   /invite-user              { email, org_id, site_id, role }
 *   PUT    /user-site-roles          { user_id, site_id, role }
 *   DELETE /user-site-roles          { user_id, site_id }
 *
 * Equipment
 *   GET    /equipment?site_id=
 *   POST   /equipment                { site_id, name, type, status, serial_no, last_service }
 *   PUT    /equipment/:id
 *   DELETE /equipment/:id
 *
 * Safety
 *   GET    /safety-incidents?site_id=
 *   POST   /safety-incidents         { site_id, title, severity, description, reported_at }
 *   PUT    /safety-incidents/:id
 *
 * Documents
 *   GET    /documents?site_id=
 *   POST   /documents/upload         multipart/form-data { site_id, file, name, category }
 *   DELETE /documents/:id
 *
 * Audit Log
 *   GET    /audit-logs?org_id=&entity_type=&action=&from=&to=&page=
 *
 * Settings / Org
 *   GET    /org/:id
 *   PUT    /org/:id                  { name, slug, timezone, currency, logo_url }
 *   POST   /org/:id/logo             multipart/form-data → { url }
 *
 * Alert Rules
 *   GET    /alert-rules?org_id=
 *   POST   /alert-rules              { org_id, name, metric, condition, threshold, notify_email }
 *   PUT    /alert-rules/:id
 *   DELETE /alert-rules/:id
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PHP RESPONSE FORMAT (required for all endpoints):
 *   Success: HTTP 200/201, body: { "data": <payload>, "error": null }
 *   Error:   HTTP 4xx/5xx, body: { "data": null, "error": "message" }
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { getBackendConfig } from "../backendConfig";

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

interface RestResponse<T> {
  data: T | null;
  error: string | null;
}

function getBaseUrl(): string {
  // Base URL is set at build time via VITE_REST_BASE_URL.
  // getBackendConfig() returns the immutable env-derived value.
  return getBackendConfig().restBaseUrl;
}

function getAuthToken(): string | null {
  // When using REST mode, the auth token is stored separately in localStorage
  // by the REST auth flow (not Supabase session).
  return localStorage.getItem("fwmining_rest_token");
}

async function restRequest<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown
): Promise<T> {
  const url = `${getBaseUrl()}${path}`;
  const token = getAuthToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  const json: RestResponse<T> = await res.json();

  if (res.status === 401) {
    // Token expired or revoked — tell AuthContext to sign the user out.
    // Using a CustomEvent keeps this module decoupled from React context.
    window.dispatchEvent(
      new CustomEvent("auth:unauthorized", { detail: { source: "rest" } })
    );
  }

  if (!res.ok || json.error) {
    throw new Error(json.error ?? `HTTP ${res.status}`);
  }

  return json.data as T;
}

// ─── Exported helpers (use these in service files) ───────────────────────────

export function restGet<T>(path: string): Promise<T> {
  return restRequest<T>("GET", path);
}

export function restPost<T>(path: string, body: unknown): Promise<T> {
  return restRequest<T>("POST", path, body);
}

export function restPut<T>(path: string, body: unknown): Promise<T> {
  return restRequest<T>("PUT", path, body);
}

export function restDel(path: string): Promise<void> {
  return restRequest<void>("DELETE", path);
}

// ─── Connection test ─────────────────────────────────────────────────────────

/**
 * Pings GET /health on the configured REST base URL.
 * The PHP API must respond with { data: { status: "ok" }, error: null }.
 * Used only for diagnostics in the Settings page — does not change any config.
 */
export async function testRestConnection(): Promise<boolean> {
  const base = getBackendConfig().restBaseUrl;
  if (!base) return false;
  try {
    const res = await fetch(`${base}/health`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    const json = await res.json();
    return res.ok && json?.data?.status === "ok";
  } catch {
    return false;
  }
}
