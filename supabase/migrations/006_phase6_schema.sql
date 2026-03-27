-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 006: Phase 6 — Equipment, Safety Incidents, Planned Shifts,
--                           Site Documents
-- Run: supabase db push
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Equipment / Asset Tracker ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.equipment (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id          uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  name             text NOT NULL,
  type             text,                        -- e.g. Excavator, Drill, Truck
  serial_number    text,
  status           text NOT NULL DEFAULT 'operational'
                     CHECK (status IN ('operational','maintenance','retired')),
  last_service_date date,
  next_service_date date,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS equipment_site_id_idx ON public.equipment(site_id);

ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_members_read_equipment"
  ON public.equipment FOR SELECT
  USING (public.has_site_access(site_id));

CREATE POLICY "site_managers_write_equipment"
  ON public.equipment FOR ALL
  USING (public.is_site_manager(site_id))
  WITH CHECK (public.is_site_manager(site_id));

-- ── Safety Incidents ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.safety_incidents (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id        uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  reported_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  severity       text NOT NULL DEFAULT 'low'
                   CHECK (severity IN ('low','medium','high','critical')),
  type           text NOT NULL DEFAULT 'near-miss'
                   CHECK (type IN ('near-miss','injury','equipment','environmental','other')),
  title          text NOT NULL,
  description    text,
  actions_taken  text,
  resolved_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS safety_incidents_site_id_idx  ON public.safety_incidents(site_id);
CREATE INDEX IF NOT EXISTS safety_incidents_severity_idx ON public.safety_incidents(severity);

ALTER TABLE public.safety_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_members_read_incidents"
  ON public.safety_incidents FOR SELECT
  USING (public.has_site_access(site_id));

CREATE POLICY "site_members_insert_incidents"
  ON public.safety_incidents FOR INSERT
  WITH CHECK (public.has_site_access(site_id));

CREATE POLICY "site_managers_update_incidents"
  ON public.safety_incidents FOR UPDATE
  USING (public.is_site_manager(site_id))
  WITH CHECK (public.is_site_manager(site_id));

CREATE POLICY "site_managers_delete_incidents"
  ON public.safety_incidents FOR DELETE
  USING (public.is_site_manager(site_id));

-- ── Planned Shifts ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.planned_shifts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id      uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  worker_id    uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  shift_date   date NOT NULL,
  start_time   time NOT NULL,
  end_time     time NOT NULL,
  notes        text,
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT planned_shifts_time_check CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS planned_shifts_site_date_idx ON public.planned_shifts(site_id, shift_date);
CREATE INDEX IF NOT EXISTS planned_shifts_worker_idx    ON public.planned_shifts(worker_id);

ALTER TABLE public.planned_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_members_read_planned_shifts"
  ON public.planned_shifts FOR SELECT
  USING (public.has_site_access(site_id));

CREATE POLICY "site_managers_write_planned_shifts"
  ON public.planned_shifts FOR ALL
  USING (public.is_site_manager(site_id))
  WITH CHECK (public.is_site_manager(site_id));

-- ── Site Documents ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.site_documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  uploaded_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name          text NOT NULL,
  category      text,                  -- e.g. Compliance, Safety, Contracts
  storage_path  text NOT NULL,         -- path inside site-documents bucket
  file_size     bigint,                -- bytes
  mime_type     text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS site_documents_site_id_idx ON public.site_documents(site_id);

ALTER TABLE public.site_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_members_read_documents"
  ON public.site_documents FOR SELECT
  USING (public.has_site_access(site_id));

CREATE POLICY "site_members_insert_documents"
  ON public.site_documents FOR INSERT
  WITH CHECK (public.has_site_access(site_id) AND uploaded_by = auth.uid());

CREATE POLICY "site_managers_delete_documents"
  ON public.site_documents FOR DELETE
  USING (public.is_site_manager(site_id));

-- ── updated_at triggers ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER equipment_updated_at
  BEFORE UPDATE ON public.equipment
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER safety_incidents_updated_at
  BEFORE UPDATE ON public.safety_incidents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
