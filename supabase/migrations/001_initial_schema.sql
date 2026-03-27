-- ============================================================
-- FW Mining OS — Initial Schema
-- Run this in your Supabase SQL Editor or via: supabase db push
-- ============================================================

-- ============================================================
-- TENANCY
-- ============================================================

create table if not exists organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text unique not null,
  logo_url   text,
  created_at timestamptz not null default now()
);

create table if not exists sites (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations(id) on delete cascade,
  name       text not null,
  location   text,
  timezone   text not null default 'UTC',
  status     text not null default 'active' check (status in ('active','inactive','decommissioned')),
  created_at timestamptz not null default now()
);

-- Extends Supabase auth.users
create table if not exists user_profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  org_id     uuid references organizations(id) on delete set null,
  full_name  text,
  avatar_url text,
  phone      text,
  created_at timestamptz not null default now()
);

create table if not exists user_site_roles (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  site_id uuid not null references sites(id) on delete cascade,
  role    text not null check (role in ('admin','site_manager','worker','viewer')),
  unique (user_id, site_id)
);

-- ============================================================
-- CORE DOMAIN
-- ============================================================

create table if not exists suppliers (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  name         text not null,
  contact_name text,
  email        text,
  phone        text,
  address      text,
  category     text,
  status       text not null default 'active' check (status in ('active','inactive')),
  created_at   timestamptz not null default now()
);

create table if not exists inventory_items (
  id             uuid primary key default gen_random_uuid(),
  site_id        uuid not null references sites(id) on delete cascade,
  supplier_id    uuid references suppliers(id) on delete set null,
  name           text not null,
  category       text,
  sku            text,
  quantity       numeric not null default 0,
  unit           text,
  unit_cost      numeric,
  reorder_level  numeric,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists transactions (
  id               uuid primary key default gen_random_uuid(),
  site_id          uuid not null references sites(id) on delete cascade,
  reference_no     text unique,
  description      text,
  category         text,
  type             text not null check (type in ('income','expense','refund')),
  status           text not null default 'pending' check (status in ('success','pending','refunded','cancelled')),
  quantity         numeric not null default 1,
  unit_price       numeric not null default 0,
  currency         text not null default 'USD',
  transaction_date date not null default current_date,
  created_by       uuid references user_profiles(id) on delete set null,
  created_at       timestamptz not null default now()
);

create table if not exists channels (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  name        text not null,
  type        text,
  description text,
  created_at  timestamptz not null default now()
);

create table if not exists orders (
  id            uuid primary key default gen_random_uuid(),
  site_id       uuid not null references sites(id) on delete cascade,
  supplier_id   uuid references suppliers(id) on delete set null,
  channel_id    uuid references channels(id) on delete set null,
  order_number  text unique,
  status        text not null default 'draft' check (status in ('draft','sent','confirmed','received','cancelled')),
  total_amount  numeric,
  expected_date date,
  received_date date,
  notes         text,
  created_by    uuid references user_profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

create table if not exists order_items (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references orders(id) on delete cascade,
  inventory_item_id uuid references inventory_items(id) on delete set null,
  quantity          numeric not null,
  unit_price        numeric not null,
  total             numeric generated always as (quantity * unit_price) stored
);

create table if not exists workers (
  id         uuid primary key default gen_random_uuid(),
  site_id    uuid not null references sites(id) on delete cascade,
  user_id    uuid references user_profiles(id) on delete set null,
  full_name  text not null,
  position   text,
  department text,
  hire_date  date,
  status     text not null default 'active' check (status in ('active','on_leave','terminated')),
  created_at timestamptz not null default now()
);

create table if not exists shift_records (
  id            uuid primary key default gen_random_uuid(),
  worker_id     uuid not null references workers(id) on delete cascade,
  site_id       uuid not null references sites(id) on delete cascade,
  shift_date    date not null,
  hours_worked  numeric,
  output_metric numeric,
  metric_unit   text,
  notes         text,
  created_at    timestamptz not null default now()
);

create table if not exists messages (
  id         uuid primary key default gen_random_uuid(),
  site_id    uuid not null references sites(id) on delete cascade,
  sender_id  uuid references user_profiles(id) on delete set null,
  content    text not null,
  channel    text not null default 'general' check (channel in ('general','safety','operations')),
  created_at timestamptz not null default now()
);

create table if not exists campaigns (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  title        text not null,
  description  text,
  status       text not null default 'draft' check (status in ('draft','active','completed','cancelled')),
  start_date   date,
  end_date     date,
  target_sites uuid[],
  created_by   uuid references user_profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references user_profiles(id) on delete cascade,
  title      text,
  body       text,
  type       text not null default 'info' check (type in ('info','alert','warning')),
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists integration_configs (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references organizations(id) on delete cascade,
  integration_type text not null,
  config           jsonb not null default '{}',
  enabled          boolean not null default false,
  created_at       timestamptz not null default now(),
  unique (org_id, integration_type)
);

-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists idx_sites_org_id on sites(org_id);
create index if not exists idx_user_profiles_org_id on user_profiles(org_id);
create index if not exists idx_user_site_roles_user_id on user_site_roles(user_id);
create index if not exists idx_user_site_roles_site_id on user_site_roles(site_id);
create index if not exists idx_inventory_items_site_id on inventory_items(site_id);
create index if not exists idx_transactions_site_id on transactions(site_id);
create index if not exists idx_transactions_date on transactions(transaction_date);
create index if not exists idx_orders_site_id on orders(site_id);
create index if not exists idx_workers_site_id on workers(site_id);
create index if not exists idx_shift_records_worker_id on shift_records(worker_id);
create index if not exists idx_messages_site_id on messages(site_id);
create index if not exists idx_notifications_user_id on notifications(user_id);

-- ============================================================
-- UPDATED_AT TRIGGER (for inventory_items)
-- ============================================================

create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger inventory_items_updated_at
  before update on inventory_items
  for each row execute function update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Helper function: returns the org_id of the currently logged-in user
create or replace function current_org_id()
returns uuid language sql stable as $$
  select org_id from user_profiles where id = auth.uid()
$$;

-- Helper function: returns site_ids accessible to the current user
create or replace function accessible_site_ids()
returns setof uuid language sql stable as $$
  select site_id from user_site_roles where user_id = auth.uid()
$$;

-- organizations
alter table organizations enable row level security;
create policy "org members can view their org"
  on organizations for select
  using (id = current_org_id());
create policy "admins can update their org"
  on organizations for update
  using (id = current_org_id());

-- sites
alter table sites enable row level security;
create policy "users can view their accessible sites"
  on sites for select
  using (id in (select accessible_site_ids()));
create policy "admins can manage sites"
  on sites for all
  using (org_id = current_org_id());

-- user_profiles
alter table user_profiles enable row level security;
create policy "users can view profiles in their org"
  on user_profiles for select
  using (org_id = current_org_id());
create policy "users can update their own profile"
  on user_profiles for update
  using (id = auth.uid());

-- user_site_roles
alter table user_site_roles enable row level security;
create policy "users can view roles in their org sites"
  on user_site_roles for select
  using (site_id in (select accessible_site_ids()));

-- suppliers (org-scoped)
alter table suppliers enable row level security;
create policy "org members can view suppliers"
  on suppliers for select
  using (org_id = current_org_id());
create policy "org members can manage suppliers"
  on suppliers for all
  using (org_id = current_org_id());

-- channels (org-scoped)
alter table channels enable row level security;
create policy "org members can manage channels"
  on channels for all
  using (org_id = current_org_id());

-- inventory_items
alter table inventory_items enable row level security;
create policy "users can access inventory for their sites"
  on inventory_items for all
  using (site_id in (select accessible_site_ids()));

-- transactions
alter table transactions enable row level security;
create policy "users can access transactions for their sites"
  on transactions for all
  using (site_id in (select accessible_site_ids()));

-- orders
alter table orders enable row level security;
create policy "users can access orders for their sites"
  on orders for all
  using (site_id in (select accessible_site_ids()));

-- order_items
alter table order_items enable row level security;
create policy "users can access order items via orders"
  on order_items for all
  using (order_id in (select id from orders where site_id in (select accessible_site_ids())));

-- workers
alter table workers enable row level security;
create policy "users can access workers for their sites"
  on workers for all
  using (site_id in (select accessible_site_ids()));

-- shift_records
alter table shift_records enable row level security;
create policy "users can access shifts for their sites"
  on shift_records for all
  using (site_id in (select accessible_site_ids()));

-- messages
alter table messages enable row level security;
create policy "users can access messages for their sites"
  on messages for all
  using (site_id in (select accessible_site_ids()));

-- campaigns (org-scoped)
alter table campaigns enable row level security;
create policy "org members can manage campaigns"
  on campaigns for all
  using (org_id = current_org_id());

-- notifications
alter table notifications enable row level security;
create policy "users can access their own notifications"
  on notifications for all
  using (user_id = auth.uid());

-- integration_configs (org-scoped)
alter table integration_configs enable row level security;
create policy "org members can manage integrations"
  on integration_configs for all
  using (org_id = current_org_id());

-- ============================================================
-- REALTIME (enable for live features)
-- ============================================================
-- Run in Supabase Dashboard → Database → Replication:
-- Enable replication for: messages, notifications
