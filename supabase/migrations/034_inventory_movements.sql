-- Inventory movement ledger: one row per receive/use/write-off/adjustment,
-- so the full buy -> use -> write-off flow of an item can be shown as a
-- single chronological timeline with a running balance.
--
-- Receiving stock previously only bumped inventory_items.quantity with no
-- record kept of when or how much; usage lived indirectly in `transactions`
-- (source = 'inventory'); write-offs had their own table. This table doesn't
-- replace those — it's an explicit, item-scoped index over all three.

create table if not exists inventory_movements (
  id                uuid primary key default gen_random_uuid(),
  site_id           uuid not null references sites(id) on delete cascade,
  inventory_item_id uuid not null references inventory_items(id) on delete cascade,
  type              text not null check (type in ('receive', 'use', 'write_off', 'adjustment')),
  quantity          numeric not null,       -- signed: positive for receive/adjustment-in, negative for use/write-off
  quantity_after    numeric not null,       -- running balance snapshot after this movement
  unit_cost         numeric,
  transaction_id    uuid references transactions(id) on delete set null,
  write_off_id      uuid references inventory_write_offs(id) on delete set null,
  customer_id       uuid references customers(id) on delete set null,
  notes             text,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now()
);

create index if not exists idx_inventory_movements_site_id on inventory_movements(site_id);
create index if not exists idx_inventory_movements_item_id on inventory_movements(inventory_item_id, created_at desc);

alter table inventory_movements enable row level security;

-- Matches the live has_site_access()/can_write_site_data() convention used
-- by inventory_write_offs, not the looser policy in that table's original
-- migration file (013) — the live policy was hardened since (see migration
-- 024/031) and local files for older tables no longer reflect it.
create policy "read inventory_movements"
  on inventory_movements for select
  using (has_site_access(site_id));

create policy "write inventory_movements"
  on inventory_movements for all
  using (can_write_site_data(site_id))
  with check (can_write_site_data(site_id));
