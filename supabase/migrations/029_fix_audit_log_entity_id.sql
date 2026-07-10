-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 029: Fix audit log entity_id extraction
-- `NEW::text::jsonb` casts a row to its Postgres row-literal text format
-- (e.g. "(id,site_id,...)"), which is not valid JSON and always throws
-- "invalid input syntax for type json" on insert/update/delete of any
-- audited table (transactions, inventory_items, equipment, safety_incidents,
-- orders, workers). Extract entity_id from the already-computed jsonb
-- payload instead.
-- Run: supabase db push
-- ─────────────────────────────────────────────────────────────────────────────

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
    v_entity_id := (v_new->>'id')::uuid;
    EXECUTE format('SELECT ($1).%I::uuid', v_site_col) INTO v_site_id USING NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action    := 'update';
    v_old       := to_jsonb(OLD);
    v_new       := to_jsonb(NEW);
    v_entity_id := (v_new->>'id')::uuid;
    EXECUTE format('SELECT ($1).%I::uuid', v_site_col) INTO v_site_id USING NEW;
  ELSIF TG_OP = 'DELETE' THEN
    v_action    := 'delete';
    v_old       := to_jsonb(OLD);
    v_entity_id := (v_old->>'id')::uuid;
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
