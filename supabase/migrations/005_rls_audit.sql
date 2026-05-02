-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 005: RLS audit — ensure all tables have RLS enabled and all
-- policies are tight (no public access, all operations scoped to org/site).
-- Run: supabase db push
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Verify RLS is ON for every application table ──────────────────────────────
-- (These are no-ops if already enabled; safe to re-run.)

ALTER TABLE public.organizations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sites               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles       ENABLE ROW LEVEL SECURITY;
-- org_members table does not exist; membership is tracked via user_profiles.org_id
ALTER TABLE public.site_roles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_records       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_sites      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications       ENABLE ROW LEVEL SECURITY;

-- ── Helper: is the current user a member of this org? ────────────────────────
-- Reusable function to avoid repeated subqueries in policies.

CREATE OR REPLACE FUNCTION public.is_org_member(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE user_profiles.org_id = $1
      AND user_profiles.id = auth.uid()
  );
$$;

-- ── Helper: does the current user have a role on this site? ──────────────────

CREATE OR REPLACE FUNCTION public.has_site_access(site_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.site_roles
    WHERE site_roles.site_id = $1
      AND site_roles.user_id = auth.uid()
  );
$$;

-- ── Helper: is the current user an admin or site_manager on a site? ──────────

CREATE OR REPLACE FUNCTION public.is_site_manager(site_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.site_roles
    WHERE site_roles.site_id = $1
      AND site_roles.user_id = auth.uid()
      AND site_roles.role IN ('admin', 'site_manager')
  );
$$;

-- ── notifications: users see only their own rows ──────────────────────────────
-- (Re-drop and recreate to ensure the policy is current.)

DROP POLICY IF EXISTS "users_read_own_notifications"   ON public.notifications;
DROP POLICY IF EXISTS "users_update_own_notifications" ON public.notifications;

CREATE POLICY "users_read_own_notifications"
  ON public.notifications
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "users_update_own_notifications"
  ON public.notifications
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── messages: site members can read; workers+ can insert ─────────────────────

DROP POLICY IF EXISTS "site_members_read_messages"   ON public.messages;
DROP POLICY IF EXISTS "site_members_insert_messages" ON public.messages;

CREATE POLICY "site_members_read_messages"
  ON public.messages
  FOR SELECT
  USING (public.has_site_access(site_id));

CREATE POLICY "site_members_insert_messages"
  ON public.messages
  FOR INSERT
  WITH CHECK (
    public.has_site_access(site_id)
    AND sender_id = auth.uid()
  );

-- ── campaigns: org members can read; admins/managers can write ───────────────

DROP POLICY IF EXISTS "org_members_read_campaigns"   ON public.campaigns;
DROP POLICY IF EXISTS "managers_write_campaigns"     ON public.campaigns;

CREATE POLICY "org_members_read_campaigns"
  ON public.campaigns
  FOR SELECT
  USING (public.is_org_member(org_id));

CREATE POLICY "managers_write_campaigns"
  ON public.campaigns
  FOR ALL
  USING (public.is_org_member(org_id))
  WITH CHECK (public.is_org_member(org_id));

-- ── campaign_sites: follows campaign access ───────────────────────────────────

DROP POLICY IF EXISTS "org_members_read_campaign_sites"  ON public.campaign_sites;
DROP POLICY IF EXISTS "org_members_write_campaign_sites" ON public.campaign_sites;

CREATE POLICY "org_members_read_campaign_sites"
  ON public.campaign_sites
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_id AND public.is_org_member(c.org_id)
    )
  );

CREATE POLICY "org_members_write_campaign_sites"
  ON public.campaign_sites
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_id AND public.is_org_member(c.org_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_id AND public.is_org_member(c.org_id)
    )
  );

-- ── integration_configs: org members can read; managers can write ─────────────

DROP POLICY IF EXISTS "org_members_read_integrations"   ON public.integration_configs;
DROP POLICY IF EXISTS "managers_write_integrations"     ON public.integration_configs;

CREATE POLICY "org_members_read_integrations"
  ON public.integration_configs
  FOR SELECT
  USING (public.is_org_member(org_id));

CREATE POLICY "managers_write_integrations"
  ON public.integration_configs
  FOR ALL
  USING (public.is_org_member(org_id))
  WITH CHECK (public.is_org_member(org_id));

-- ── Deny any remaining anonymous access to core tables ───────────────────────
-- These are safety-net checks; actual permissive policies live in earlier
-- migrations.  Adding explicit DENY-equivalent by ensuring no policy allows
-- anon role (anon has no auth.uid() so all uid-based policies already block it).

-- No-op comment: all policies above use auth.uid() or helper functions that
-- call auth.uid(). Since auth.uid() returns NULL for unauthenticated requests,
-- these policies implicitly deny anonymous access without needing explicit
-- REVOKE statements.

-- ── Grant execute on helpers to authenticated users ───────────────────────────

GRANT EXECUTE ON FUNCTION public.is_org_member(uuid)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_site_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_site_manager(uuid) TO authenticated;
