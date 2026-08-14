import type { QueryClient } from "@tanstack/react-query";

/** Every query-key family that caches a customer list, across the app's surfaces:
 *  - "customers"          — main app (CustomersPage, Dashboard, reports, …)
 *  - "customers-page"     — capture surface (CaptureCustomers, CaptureCustomerReport)
 *  - "activity-customers" — Activity page
 *  The capture EntryPad picker keys on ["capture","customers",…], which also
 *  contains "customers", so it is covered too. */
const CUSTOMER_KEY_SEGMENTS = ["customers", "customers-page", "activity-customers"];

/** Invalidate every customer-list cache so a customer added, edited, or removed on
 *  one surface shows up on all the others immediately. Use this for any customer
 *  mutation instead of invalidating a single surface's key (which lets the surfaces
 *  drift out of sync until a full reload). */
export function invalidateCustomerCaches(qc: QueryClient) {
  return qc.invalidateQueries({
    predicate: (q) =>
      q.queryKey.some((k) => typeof k === "string" && CUSTOMER_KEY_SEGMENTS.includes(k)),
  });
}
