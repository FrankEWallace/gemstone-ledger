-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 009: Phase 8 — KPI Targets, Production Logs, Email Report Prefs
-- Run: supabase db push
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Onboarding flag on user_profiles ─────────────────────────────────────────
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

-- ── KPI Targets ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kpi_targets (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id               uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  month                 date NOT NULL,           -- first day of month, e.g. 2026-03-01
  revenue_target        numeric,
  expense_budget        numeric,
  shift_target          integer,                 -- number of shifts planned
  equipment_uptime_pct  numeric,                 -- target % (0–100)
  ore_tonnes_target     numeric,
  created_by            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, month)
);

CREATE INDEX IF NOT EXISTS kpi_targets_site_month_idx ON public.kpi_targets(site_id, month);

ALTER TABLE public.kpi_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_members_read_kpi_targets"
  ON public.kpi_targets FOR SELECT
  USING (public.has_site_access(site_id));

CREATE POLICY "site_managers_write_kpi_targets"
  ON public.kpi_targets FOR ALL
  USING (public.is_site_manager(site_id))
  WITH CHECK (public.is_site_manager(site_id));

CREATE TRIGGER kpi_targets_updated_at
  BEFORE UPDATE ON public.kpi_targets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Production Logs ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.production_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  log_date      date NOT NULL,
  ore_tonnes    numeric,          -- ore extracted (tonnes)
  waste_tonnes  numeric,          -- waste moved (tonnes)
  grade_g_t     numeric,          -- ore grade (grams per tonne)
  water_m3      numeric,          -- water usage (cubic metres)
  notes         text,
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, log_date)
);

CREATE INDEX IF NOT EXISTS production_logs_site_date_idx ON public.production_logs(site_id, log_date DESC);

ALTER TABLE public.production_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_members_read_production_logs"
  ON public.production_logs FOR SELECT
  USING (public.has_site_access(site_id));

CREATE POLICY "site_members_insert_production_logs"
  ON public.production_logs FOR INSERT
  WITH CHECK (public.has_site_access(site_id));

CREATE POLICY "site_managers_update_production_logs"
  ON public.production_logs FOR UPDATE
  USING (public.is_site_manager(site_id))
  WITH CHECK (public.is_site_manager(site_id));

CREATE POLICY "site_managers_delete_production_logs"
  ON public.production_logs FOR DELETE
  USING (public.is_site_manager(site_id));

CREATE TRIGGER production_logs_updated_at
  BEFORE UPDATE ON public.production_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Email report preferences on organizations ─────────────────────────────────
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS weekly_report_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS weekly_report_email    text;
