-- 038: Viewers are read-only — gate the three inserts 031 missed.
--
-- 031 moved most site tables onto can_write_site_data (admin/site_manager/
-- worker, plus org owners/admins), but production_logs, safety_incidents and
-- site_documents kept INSERT policies checking only has_site_access, so a
-- viewer could create rows via the REST API. Found in the 2026-10-08 audit.
--
-- Side effect: org owners/admins without an explicit site role can now insert
-- here too, matching every other site table.

drop policy if exists site_members_insert_production_logs on public.production_logs;
create policy site_members_insert_production_logs on public.production_logs
  for insert to authenticated
  with check (public.can_write_site_data(site_id));

drop policy if exists site_members_insert_incidents on public.safety_incidents;
create policy site_members_insert_incidents on public.safety_incidents
  for insert to authenticated
  with check (public.can_write_site_data(site_id));

drop policy if exists site_members_insert_documents on public.site_documents;
create policy site_members_insert_documents on public.site_documents
  for insert to authenticated
  with check (public.can_write_site_data(site_id) and uploaded_by = auth.uid());
