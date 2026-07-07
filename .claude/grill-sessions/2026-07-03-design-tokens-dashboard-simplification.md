---
date: 2026-07-03
topic: "Design token gaps (vs Vercel Geist) and dashboard simplification"
outcome: "Full plan agreed: global status registry + StatusBadge with sweep & lint enforcement, shadow/motion tokens in ui/ components, 3-role type utilities, component consolidation, and a dashboard restructure — shipped as 4 sequential branches."
---

# Grill Session: Design Tokens & Dashboard Simplification

Context: audit found 178 raw Tailwind palette usages across 38 files (3 duplicated
`STATUS_COLORS` maps in CampaignsPage/EquipmentPage/OrdersPage), no `--info` token,
no shadow scale (plus the brittle `.rounded-xl.bg-card` override in `src/index.css`),
no motion tokens, 6 type sizes on the dashboard (blueprint rule: max 3), ~40
arbitrary px values, StatCard/KpiCard duplication, EmptyState under-adopted.
Research notebook: NotebookLM `5979f416` "Premium SaaS Dashboard UI/UX Research".

## Q&A

1. **Q:** How should the status→color mapping be organized across domains?
   **A:** One global registry — `lib/status.ts` mapping every domain status string
   to one of 5 semantic variants (success / warning / destructive / info /
   neutral), consumed by one shared `StatusBadge`.

2. **Q:** How do we handle decorative accent color (tinted icon chips, highlight
   boxes) that isn't a status?
   **A:** Reuse the existing `--chart-1..10` palette (already has dark-mode
   variants) via a small tint utility — no new accent token set.

3. **Q:** Migration and enforcement for the 38 files?
   **A:** One focused sweep, then an ESLint `no-restricted-syntax` rule banning
   raw palette classes outside `components/ui`.

4. **Q:** Shadows and motion?
   **A:** Both, in components: `--shadow-card/--shadow-popover/--shadow-modal`
   (light+dark) applied inside card/popover/dialog/dropdown/tooltip; delete the
   `.rounded-xl.bg-card` selector override. Add `--duration-fast/base/slow`
   (150/200/300ms) + one easing token, used in ui/ transitions.

5. **Q:** How strictly do we enforce a type scale?
   **A:** 3 roles as utilities — `.text-display` (2xl, font-display, page titles
   + primary KPI values), `.text-body` (sm), `.text-caption` (xs, muted). Migrate
   the dashboard; raw `text-*` sizes become a review flag.

6. **Q:** Component consolidation scope?
   **A:** Merge + adopt everywhere: fold StatCard into KpiCard (renamed StatCard
   in `shared/`, optional trend/href props), and sweep all hand-rolled empty
   states to use `EmptyState`.

7. **Q:** Arbitrary px values — how far?
   **A:** Fix the 4px-rule violations ([2px]/[3px]/[10px]) and add
   `h-chart-sm/md/lg` tokens (~180/220/400px); leave one-off column/dropdown
   widths alone.

8. **Q:** Customer filtering (header dropdown vs CustomerInsights, which both
   filter)?
   **A:** Filter via insights only — drop CustomerSelect from the header; clicking
   a customer row in CustomerInsights sets the filter; show a "filtered by X ×"
   chip in the header when active.

9. **Q:** Lower half of the dashboard?
   **A:** Full restructure — SiteStatusStrip becomes a slim one-line strip directly
   under the header; RecentTransactions capped at 5 rows + "View all";
   CustomerInsights collapsed by default. Above the fold: title, pills, status
   line, 3 KPIs, breakdowns.

10. **Q:** Conflict check — the only filter mechanism (CustomerInsights) is
    collapsed by default. Acceptable?
    **A:** Acceptable — customer filtering is a drill-down, not a primary task;
    the active-filter chip in the header keeps applied filters visible.

11. **Q:** Sequencing?
    **A:** 4 branches in order, each independently verifiable:
    A) tokens + StatusBadge/registry + 38-file sweep + ESLint rule →
    B) shadow/motion tokens in ui/ components →
    C) type utilities + px fixes + StatCard merge + EmptyState adoption →
    D) dashboard restructure.
    Current branch (security-025-checkemail-campaigns-docs) merges first.

## Key Decisions

- Add `--info`/`--info-foreground`; status tiers via the existing Badge pattern
  (`bg-X/10 border-X/20 text-X`).
- One global status registry (`lib/status.ts`) + one `StatusBadge`; delete all
  per-page `STATUS_COLORS` maps.
- Decorative accents draw from chart palette tokens; no new accent token set.
- Big-bang sweep of all 38 files, locked in with an ESLint rule banning raw
  palette classes outside `components/ui`.
- 3-tier shadow tokens + motion tokens applied inside ui/ components; remove the
  `.rounded-xl.bg-card` CSS override.
- Type scale: `.text-display` / `.text-body` / `.text-caption` utilities.
- Fix 4px-rule px violations; tokenize chart heights only.
- Merge StatCard/KpiCard; adopt EmptyState everywhere.
- Dashboard: header = title + period pills (+ active-filter chip); slim site
  status line under header; 3 KPIs (Net Profit prominent); breakdowns;
  CustomerInsights collapsed (doubles as the customer filter);
  RecentTransactions capped at 5.
- Ship as 4 sequential branches: tokens → shadows/motion → type/components →
  dashboard.

## Open Questions

- None.
