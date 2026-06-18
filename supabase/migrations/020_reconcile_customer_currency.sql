-- 020: Reconcile schema divergence between code and prod.
-- The UI/services already reference these columns but they were never added
-- to the production database (verified via information_schema on 2026-06-18).

-- Link production logs to a customer (nullable; not every log is customer-attributed).
ALTER TABLE public.production_logs
  ADD COLUMN IF NOT EXISTS customer_id uuid
  REFERENCES public.customers(id) ON DELETE SET NULL;

-- Per-organisation display/reporting currency (settings page already exposes a selector).
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'TZS';
