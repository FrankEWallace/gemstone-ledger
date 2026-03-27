-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 007: Audit Log
-- Captures who did what on which entity with before/after payloads.
-- Run: supabase db push
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id      uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  actor_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type  text NOT NULL,    -- 'inventory_item' | 'transaction' | 'equipment' | etc.
  entity_id    uuid,
  action       text NOT NULL CHECK (action IN ('create','update','delete')),
  old_data     jsonb,
  new_data     jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_site_id_idx    ON public.audit_logs(site_id);
CREATE INDEX IF NOT EXISTS audit_logs_actor_id_idx   ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx     ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON public.audit_logs(created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only site members can read audit logs for their sites
CREATE POLICY "site_members_read_audit_logs"
  ON public.audit_logs FOR SELECT
  USING (
    site_id IS NULL
    OR public.has_site_access(site_id)
  );

-- Only service role (triggers) can insert — no direct client inserts
-- (Policies default-deny INSERT for authenticated users unless we add one)

-- ── Trigger function ──────────────────────────────────────────────────────────
-- Logs changes to a given table. site_id_col and entity_type are injected
-- per-trigger via TG_ARGV.
-- Usage: EXECUTE FUNCTION public.log_audit_event('inventory_items', 'site_id')

CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_entity_type text := TG_ARGV[0];
  v_site_col    text := TG_ARGV[1];
  v_site_id     uuid;
  v_entity_id   uuid;
  v_action      text;
  v_old         jsonb;
  v_new         jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action    := 'create';
    v_new       := to_jsonb(NEW);
    v_entity_id := (NEW::text::jsonb)->>'id';
    EXECUTE format('SELECT ($1).%I::uuid', v_site_col) INTO v_site_id USING NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action    := 'update';
    v_old       := to_jsonb(OLD);
    v_new       := to_jsonb(NEW);
    v_entity_id := (NEW::text::jsonb)->>'id';
    EXECUTE format('SELECT ($1).%I::uuid', v_site_col) INTO v_site_id USING NEW;
  ELSIF TG_OP = 'DELETE' THEN
    v_action    := 'delete';
    v_old       := to_jsonb(OLD);
    v_entity_id := (OLD::text::jsonb)->>'id';
    EXECUTE format('SELECT ($1).%I::uuid', v_site_col) INTO v_site_id USING OLD;
  END IF;

  INSERT INTO public.audit_logs (site_id, actor_id, entity_type, entity_id, action, old_data, new_data)
  VALUES (
    v_site_id,
    auth.uid(),
    v_entity_type,
    v_entity_id,
    v_action,
    v_old,
    v_new
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ── Attach triggers to key tables ─────────────────────────────────────────────

CREATE TRIGGER audit_inventory_items
  AFTER INSERT OR UPDATE OR DELETE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event('inventory_item', 'site_id');

CREATE TRIGGER audit_transactions
  AFTER INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event('transaction', 'site_id');

CREATE TRIGGER audit_equipment
  AFTER INSERT OR UPDATE OR DELETE ON public.equipment
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event('equipment', 'site_id');

CREATE TRIGGER audit_safety_incidents
  AFTER INSERT OR UPDATE OR DELETE ON public.safety_incidents
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event('safety_incident', 'site_id');

CREATE TRIGGER audit_orders
  AFTER INSERT OR UPDATE OR DELETE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event('order', 'site_id');

CREATE TRIGGER audit_workers
  AFTER INSERT OR UPDATE OR DELETE ON public.workers
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event('worker', 'site_id');
