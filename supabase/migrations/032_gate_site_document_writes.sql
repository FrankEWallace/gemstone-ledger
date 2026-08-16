-- 032: Finding 3 — gate site-documents upload/delete to writers (workers+).
--
-- Migration 016 allowed any site member — including a viewer — to upload and
-- delete documents for their site. Reads stay open to all site members; writes
-- now require a worker/site_manager/admin role on the site (viewers read-only),
-- matching the operational-data matrix from migration 031.

drop policy if exists "site members can upload documents" on storage.objects;
drop policy if exists "site members can delete documents" on storage.objects;

create policy "site writers can upload documents"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'site-documents'
    and (storage.foldername(name))[1] in (
      select site_id::text from public.user_site_roles
      where user_id = auth.uid()
        and role in ('admin', 'site_manager', 'worker')
    )
  );

create policy "site writers can delete documents"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'site-documents'
    and (storage.foldername(name))[1] in (
      select site_id::text from public.user_site_roles
      where user_id = auth.uid()
        and role in ('admin', 'site_manager', 'worker')
    )
  );
