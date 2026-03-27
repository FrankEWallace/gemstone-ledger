-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 008: Custom Alert Rules
-- Users define threshold rules; the evaluate-alerts Edge Function fires them.
-- Run: supabase db push
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.alert_rules (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id             uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  created_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name                text NOT NULL,
  entity_type         text NOT NULL
                        CHECK (entity_type IN ('inventory_item','equipment','safety_incident')),
  -- For inventory_item: field = 'quantity', operator = 'lte', threshold = number
  -- For equipment:       field = 'days_since_service', operator = 'gte', threshold = number
  -- For safety_incident: field = 'open_count', operator = 'gte', threshold = number
  field               text NOT NULL,
  operator            text NOT NULL CHECK (operator IN ('gte','lte','gt','lt','eq')),
  threshold           numeric NOT NULL,
  notification_title  text NOT NULL,
  notification_body   text,
  enabled             boolean NOT NULL DEFAULT true,
  last_triggered_at   timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS alert_rules_site_id_idx ON public.alert_rules(site_id);

ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_members_read_alert_rules"
  ON public.alert_rules FOR SELECT
  USING (public.has_site_access(site_id));

CREATE POLICY "site_managers_write_alert_rules"
  ON public.alert_rules FOR ALL
  USING (public.is_site_manager(site_id))
  WITH CHECK (public.is_site_manager(site_id));
