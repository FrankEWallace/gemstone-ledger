create table if not exists inventory_write_offs (
  id                uuid primary key default gen_random_uuid(),
  site_id           uuid not null references sites(id) on delete cascade,
  inventory_item_id uuid not null references inventory_items(id) on delete cascade,
  quantity          numeric not null check (quantity > 0),
  reason            text not null check (reason in ('damaged', 'expired', 'theft', 'stocktake')),
  notes             text,
  written_off_at    date not null default current_date,
  written_off_by    uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now()
);

create index idx_inventory_write_offs_site_id on inventory_write_offs(site_id);
create index idx_inventory_write_offs_item_id on inventory_write_offs(inventory_item_id);
create index idx_inventory_write_offs_date    on inventory_write_offs(written_off_at);

alter table inventory_write_offs enable row level security;

create policy "users can access write-offs for their sites"
  on inventory_write_offs for all
  using (
    site_id in (
      select s.id from sites s
      join user_profiles up on up.org_id = s.org_id
      where up.id = auth.uid()
    )
  );
