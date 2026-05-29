-- ============================================================
-- 018: User-level notification preferences
--
-- Adds a per-user notification preferences blob, distinct from the
-- org-level weekly_report settings (migration 009) and the per-rule
-- notify_email on alert_rules (migration 008).
--
-- Stored as JSONB so new preference keys can be added later without a
-- schema migration. Seeded with the master email switch enabled.
--
-- Self-update is already permitted by the existing
-- "users can update their own profile" policy (migration 001), which is
-- column-agnostic — no new RLS policy is required.
-- ============================================================

alter table user_profiles
  add column if not exists notification_prefs jsonb not null
    default '{"email_enabled": true}'::jsonb;
