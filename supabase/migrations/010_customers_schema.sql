-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 010: Customer-Centric Model — customers, expense_categories
-- Run: supabase db push
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Customers ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customers (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id          uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  org_id           uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name             text NOT NULL,
  type             text NOT NULL DEFAULT 'external' CHECK (type IN ('external', 'internal')),
  contact_name     text,
  contact_email    text,
  contact_phone    text,
  contract_start   date,
  contract_end     date,
  daily_rate       numeric,
  notes            text,
  status           text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'completed')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customers_site_id_idx ON public.customers(site_id);
CREATE INDEX IF NOT EXISTS customers_org_id_idx  ON public.customers(org_id);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_members_read_customers"
  ON public.customers FOR SELECT
  USING (public.has_site_access(site_id));

CREATE POLICY "site_managers_insert_customers"
  ON public.customers FOR INSERT
  WITH CHECK (public.is_site_manager(site_id));

CREATE POLICY "site_managers_update_customers"
  ON public.customers FOR UPDATE
  USING (public.is_site_manager(site_id))
  WITH CHECK (public.is_site_manager(site_id));

CREATE POLICY "site_managers_delete_customers"
  ON public.customers FOR DELETE
  USING (public.is_site_manager(site_id));

CREATE TRIGGER customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Expense Categories ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  color       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, name)
);

CREATE INDEX IF NOT EXISTS expense_categories_org_id_idx ON public.expense_categories(org_id);

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

-- Org-level access: any org member can read; only admins/managers can write
CREATE POLICY "org_members_read_expense_categories"
  ON public.expense_categories FOR SELECT
  USING (
    org_id IN (
      SELECT up.org_id FROM public.user_profiles up WHERE up.id = auth.uid()
    )
  );

CREATE POLICY "org_members_write_expense_categories"
  ON public.expense_categories FOR ALL
  USING (
    org_id IN (
      SELECT up.org_id FROM public.user_profiles up WHERE up.id = auth.uid()
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT up.org_id FROM public.user_profiles up WHERE up.id = auth.uid()
    )
  );

CREATE TRIGGER expense_categories_updated_at
  BEFORE UPDATE ON public.expense_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Alter transactions table ──────────────────────────────────────────────────
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS customer_id         uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS expense_category_id uuid REFERENCES public.expense_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS transactions_customer_id_idx          ON public.transactions(customer_id);
CREATE INDEX IF NOT EXISTS transactions_expense_category_id_idx  ON public.transactions(expense_category_id);

-- ── Seed default "Internal Operations" customer for each existing site ─────────
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id AS site_id, org_id FROM public.sites LOOP
    INSERT INTO public.customers (site_id, org_id, name, type, notes, status)
    VALUES (r.site_id, r.org_id, 'Internal Operations', 'internal', 'Default internal cost centre for company-owned operations.', 'active')
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

-- ── Seed default expense categories for each existing organisation ─────────────
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id AS org_id FROM public.organizations LOOP
    INSERT INTO public.expense_categories (org_id, name, description, color) VALUES
      (r.org_id, 'Chemicals/Reagents', 'Cyanide, lime, activated carbon and other process chemicals', '#7c3aed'),
      (r.org_id, 'Fuel',               'Diesel, petrol and other fuel costs',                          '#dc2626'),
      (r.org_id, 'Labor',              'Payroll, contractor labour and workforce costs',                '#2563eb'),
      (r.org_id, 'Maintenance',        'Equipment parts, repairs and servicing',                       '#d97706'),
      (r.org_id, 'Transport',          'Ore haulage, logistics and freight',                           '#059669')
    ON CONFLICT (org_id, name) DO NOTHING;
  END LOOP;
END;
$$;
