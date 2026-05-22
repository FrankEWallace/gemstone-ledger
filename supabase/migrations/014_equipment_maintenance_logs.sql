create table if not exists equipment_maintenance_logs (
  id               uuid primary key default gen_random_uuid(),
  equipment_id     uuid not null references equipment(id) on delete cascade,
  site_id          uuid not null references sites(id) on delete cascade,
  service_date     date not null,
  description      text not null,
  cost             numeric(12, 2),
  performed_by     text,
  next_service_date date,
  created_at       timestamptz not null default now()
);

create index equipment_maintenance_logs_equipment_id_idx on equipment_maintenance_logs(equipment_id);
create index equipment_maintenance_logs_site_id_idx on equipment_maintenance_logs(site_id);

alter table equipment_maintenance_logs enable row level security;

create policy "site members can manage maintenance logs"
  on equipment_maintenance_logs
  for all
  using (
    site_id in (
      select site_id from user_site_roles where user_id = auth.uid()
    )
  );
