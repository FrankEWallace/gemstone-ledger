// Global status → semantic-variant registry.
// Every domain status renders through one of five semantic intents so the same
// state always gets the same color app-wide. Add new statuses here, never as
// raw palette classes at the call site.

export type StatusVariant = "success" | "warning" | "destructive" | "info" | "neutral";

const STATUS_VARIANTS: Record<string, StatusVariant> = {
  // generic outcomes
  success: "success",
  completed: "success",
  approved: "success",
  paid: "success",
  resolved: "success",
  pending: "warning",
  failed: "destructive",
  error: "destructive",
  cancelled: "destructive",
  rejected: "destructive",
  conflict: "warning",
  draft: "neutral",
  archived: "neutral",
  inactive: "neutral",

  // campaigns
  active: "success",
  scheduled: "info",
  ended: "neutral",

  // customers / payments
  prospect: "info",
  refunded: "neutral",

  // team / workers
  on_leave: "warning",
  terminated: "neutral",

  // supply-chain orders
  sent: "info",
  confirmed: "warning",
  received: "success",

  // equipment
  operational: "success",
  maintenance: "warning",
  retired: "neutral",

  // safety resolution
  open: "destructive",
  under_review: "warning",

  // safety severity
  low: "neutral",
  medium: "warning",
  high: "destructive",
  critical: "destructive",

  // inventory stock
  in: "success",
  out: "destructive",
};

export function statusVariant(status: string): StatusVariant {
  return STATUS_VARIANTS[status] ?? "neutral";
}

/** "under_review" → "Under review" */
export function statusLabel(status: string): string {
  const words = status.replace(/[_-]/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
