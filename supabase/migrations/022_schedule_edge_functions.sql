-- 022: Schedule the alert + weekly-report edge functions.
-- Both functions were deployed but never invoked automatically (no schedule),
-- so threshold alerts and weekly digests only fired when triggered by hand.
--
-- Invocation auth: the functions have verify_jwt=true; the public anon key is a
-- valid JWT and is sufficient (each function uses its own SERVICE_ROLE_KEY env
-- for data access). The anon key is read from Vault secret 'project_anon_key'
-- (create it once with: select vault.create_secret('<anon key>','project_anon_key')).
--
-- Hardening note: these endpoints are then triggerable by anyone holding the
-- (public) anon key. To lock them to cron only, set a CRON_SECRET edge-function
-- secret, deploy with verify_jwt=false, and send 'Authorization: Bearer <secret>'.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Evaluate alert rules every 15 minutes.
select cron.schedule(
  'evaluate-alerts',
  '*/15 * * * *',
  $job$
  select net.http_post(
    url     := 'https://fefxtysvtavlzqjowdee.supabase.co/functions/v1/evaluate-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'project_anon_key')
    ),
    body    := '{}'::jsonb
  );
  $job$
);

-- Send the weekly KPI digest every Monday at 08:00 UTC.
select cron.schedule(
  'send-weekly-report',
  '0 8 * * 1',
  $job$
  select net.http_post(
    url     := 'https://fefxtysvtavlzqjowdee.supabase.co/functions/v1/send-weekly-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'project_anon_key')
    ),
    body    := '{}'::jsonb
  );
  $job$
);
