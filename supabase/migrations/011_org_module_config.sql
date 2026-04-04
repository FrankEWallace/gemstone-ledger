-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 011: Org-level module configuration
-- Admins can disable specific modules org-wide (hidden from all users in org).
-- disabled_modules stores a JSON array of module key strings, e.g. ["messages","campaigns"]
-- Empty array (default) = all modules enabled.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS disabled_modules jsonb NOT NULL DEFAULT '[]'::jsonb;
