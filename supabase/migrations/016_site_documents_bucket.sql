insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-documents',
  'site-documents',
  false,
  20971520,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do nothing;

create policy "site members can upload documents"
  on storage.objects for insert
  with check (
    bucket_id = 'site-documents'
    and (storage.foldername(name))[1] in (
      select site_id::text from user_site_roles where user_id = auth.uid()
    )
  );

create policy "site members can read documents"
  on storage.objects for select
  using (
    bucket_id = 'site-documents'
    and (storage.foldername(name))[1] in (
      select site_id::text from user_site_roles where user_id = auth.uid()
    )
  );

create policy "site members can delete documents"
  on storage.objects for delete
  using (
    bucket_id = 'site-documents'
    and (storage.foldername(name))[1] in (
      select site_id::text from user_site_roles where user_id = auth.uid()
    )
  );
