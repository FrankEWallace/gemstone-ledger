export const DEMO_FLAG = "fw-demo-mode";

export function isDemoMode(): boolean {
  return localStorage.getItem(DEMO_FLAG) === "1";
}

export function enterDemoMode(): void {
  localStorage.setItem(DEMO_FLAG, "1");
  // Keep activeSiteId pointing at the demo site
  localStorage.setItem("activeSiteId", DEMO_SITE_ID);
}

export function exitDemoMode(): void {
  localStorage.removeItem(DEMO_FLAG);
  localStorage.removeItem("activeSiteId");
}

// Stable IDs used throughout demo data
export const DEMO_USER_ID  = "demo-user-00000000";
export const DEMO_ORG_ID   = "demo-org-000000000";
export const DEMO_SITE_ID  = "demo-site-00000000";
