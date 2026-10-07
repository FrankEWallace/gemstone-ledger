---
date: 2026-10-07
topic: "Reports & Analytics landing page: replace selection cards with a 3-tab interface"
outcome: "Reports landing page becomes a pure redirect to the last-viewed report, with a new shared underline tab bar (Production / Finance Overview / Inventory Overview) replacing the old card grid and back-links."
---

# Grill Session: Reports Tab Bar Redesign

## Q&A

1. **Q:** Should the three tabs be real routes (`/reports/production`, `/reports/overview`, `/reports/inventory`) or client-side tab state on one route?
   **A:** Real routes — confirmed (recommended).

2. **Q:** Does the new top-level tab bar replace Finance Overview's existing internal sub-nav (Overview/Expenses/Income/Customers), or sit alongside it as a separate, additional bar?
   **A:** Option B — separate, additional bar; no merge with the existing sub-nav.

3. **Q:** Should visiting `/reports` auto-redirect to the remembered last-viewed report, or just show a static default / passively highlight it?
   **A:** Auto-redirect — confirmed (recommended).

4. **Q:** Does the new tab bar replace the "← Reports" back-link on all three report pages?
   **A:** Yes — confirmed.

5. **Q:** Should the "last viewed" memory track the exact sub-page (e.g. Expenses) or just the top-level bucket (Production/Finance/Inventory)?
   **A:** Top-level bucket only — confirmed (recommended).

6. **Q:** Should the landing page's period presets and 4-stat KPI strip be deleted, since that content is redundant with what's already inside Finance Overview?
   **A:** Yes, delete entirely — confirmed.

7. **Q:** Should the new tab bar be a new, separate component (not a modified `ReportsSubNav`), styled identically (sticky, underline, border-bottom)?
   **A:** Yes — confirmed.

8. **Q:** Should "last viewed report" be stored globally (one localStorage key) or scoped per site?
   **A:** Global — confirmed (recommended).

9. **Q:** Should the date range (`from`/`to` query params) carry over when switching between top-level tabs, using the same technique `ReportsSubNav` already uses?
   **A:** Yes, same mechanism — confirmed (recommended).

## Key Decisions

- New shared component `ReportsTopNav.tsx` (`src/components/reports/ReportsTopNav.tsx`): 3 underline tabs (Production / Finance Overview / Inventory Overview), styled like `ReportsSubNav`, carrying forward `from`/`to` query params, and writing the current top-level bucket to `localStorage` (`reports:lastViewed`) on every visit.
- `ReportsPage.tsx` is now a pure `<Navigate replace>` redirect based on the remembered bucket, defaulting to Finance Overview (`/reports/overview`) if nothing is recorded or storage is unavailable. The old period-presets UI, 4-stat KPI strip, and `ReportCard` grid were deleted.
- `ReportsTopNav` replaces the "← Reports" back-link on `ProductionReportPage.tsx` and `InventoryReportPage.tsx`, and is added above the existing `ReportsSubNav` on `OverviewReportPage.tsx` (which had no back-link before).
- `ReportsSubNav` gained an optional `topOffset` prop so it can sit correctly below the new sticky `ReportsTopNav` on Finance Overview's pages instead of overlapping it.
- Verified in-browser: tab switching, date-range carryover across tabs, and `/reports` → last-viewed-bucket redirect all work as designed.

## Open Questions

- None.
