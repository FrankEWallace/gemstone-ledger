-- 023: Lock down the scheduled edge functions with a Vault-backed cron secret.
--
-- Previously the cron jobs authenticated with the public anon key, which meant
-- anyone holding it could trigger the functions (incl. report emails). Now:
--   - the secret is generated server-side and stored only in Vault (never in git);
--   - cron sends it as the bearer token;
--   - the edge functions accept EITHER this secret (cron) OR a valid user JWT
--     (the in-app "Run now" / "send report" buttons), via is_cron_secret().
-- An anon token has no user, so it now fails both checks.

-- Validate a bearer token against the Vault-stored cron secret. service_role only.
create or replace function public.is_cron_secret(p_token text)
returns boolean
language sql
security definer
set search_path = public, vault
as $$
  select exists (
    select 1 from vault.decrypted_secrets
    where name = 'cron_secret' and decrypted_secret = p_token
  );
$$;

revoke all on function public.is_cron_secret(text) from public, anon, authenticated;
grant execute on function public.is_cron_secret(text) to service_role;

-- Generate the cron secret once (random 32-byte hex; stored encrypted in Vault).
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'cron_secret') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'cron_secret',
      'Shared secret for pg_cron -> edge function authentication'
    );
  end if;
end $$;

-- Reschedule both jobs to authenticate with the cron secret (cron.schedule
-- upserts by job name).
select cron.schedule('evaluate-alerts', '*/15 * * * *', $job$
  select net.http_post(
    url     := 'https://fefxtysvtavlzqjowdee.supabase.co/functions/v1/evaluate-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body    := '{}'::jsonb
  );
$job$);

select cron.schedule('send-weekly-report', '0 8 * * 1', $job$
  select net.http_post(
    url     := 'https://fefxtysvtavlzqjowdee.supabase.co/functions/v1/send-weekly-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body    := '{}'::jsonb
  );
$job$);
