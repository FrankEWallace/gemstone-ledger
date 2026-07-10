-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 028: Production Phases (batch/campaign cost rollups)
-- Run: supabase db push
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Production Phases ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.production_phases (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id    uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  org_id     uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name       text NOT NULL,
  status     text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  start_date date,
  end_date   date,
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS production_phases_site_id_idx ON public.production_phases(site_id);
CREATE INDEX IF NOT EXISTS production_phases_org_id_idx  ON public.production_phases(org_id);

ALTER TABLE public.production_phases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_members_read_production_phases"
  ON public.production_phases FOR SELECT
  USING (public.has_site_access(site_id));

CREATE POLICY "site_managers_insert_production_phases"
  ON public.production_phases FOR INSERT
  WITH CHECK (public.is_site_manager(site_id));

CREATE POLICY "site_managers_update_production_phases"
  ON public.production_phases FOR UPDATE
  USING (public.is_site_manager(site_id))
  WITH CHECK (public.is_site_manager(site_id));

CREATE POLICY "site_managers_delete_production_phases"
  ON public.production_phases FOR DELETE
  USING (public.is_site_manager(site_id));

CREATE TRIGGER production_phases_updated_at
  BEFORE UPDATE ON public.production_phases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Alter transactions table ──────────────────────────────────────────────────
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS phase_id uuid REFERENCES public.production_phases(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS transactions_phase_id_idx ON public.transactions(phase_id);

-- ── Seed additional default expense categories for each existing organisation ──
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id AS org_id FROM public.organizations LOOP
    INSERT INTO public.expense_categories (org_id, name, description, color, type) VALUES
      (r.org_id, 'Electricity/Utilities',        'Grid power, generator fuel surcharge and other site utilities', '#0284c7', 'expense'),
      (r.org_id, 'Processing/Operating Costs',   'Elution, ore/mineral processing days and general operating costs not covered elsewhere', '#65a30d', 'expense')
    ON CONFLICT (org_id, name) DO NOTHING;
  END LOOP;
END;
$$;
