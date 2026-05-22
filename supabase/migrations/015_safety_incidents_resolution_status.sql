alter table safety_incidents
  add column if not exists resolution_status text not null default 'open'
    check (resolution_status in ('open', 'under_review', 'resolved')),
  add column if not exists resolution_notes text;

update safety_incidents
  set resolution_status = 'resolved'
  where resolved_at is not null;
