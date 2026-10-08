-- 039: Per-user rate limits for email-sending edge functions.
--
-- invite-user and send-support-message had no limits, so one signed-in user
-- could loop either endpoint and send unlimited email (invite spam to
-- arbitrary addresses, Resend quota burn). Found in the 2026-10-08 audit.
--
-- Fixed-window counter keyed by (bucket, user). Only service_role can touch
-- it — edge functions call hit_rate_limit() with their admin client after
-- authenticating the caller, so the key can't be spoofed by the client.

create table if not exists public.rate_limits (
  bucket       text        not null,
  subject      uuid        not null,
  window_start timestamptz not null,
  hits         int         not null default 0,
  primary key (bucket, subject)
);

alter table public.rate_limits enable row level security;
-- No policies: invisible to anon/authenticated. service_role bypasses RLS.
revoke all on public.rate_limits from anon, authenticated;

-- Records one hit and returns true if the caller is still within the limit.
create or replace function public.hit_rate_limit(
  p_bucket text,
  p_subject uuid,
  p_max int,
  p_window interval
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hits int;
begin
  insert into rate_limits as r (bucket, subject, window_start, hits)
  values (p_bucket, p_subject, now(), 1)
  on conflict (bucket, subject) do update
    set hits = case when r.window_start < now() - p_window then 1 else r.hits + 1 end,
        window_start = case when r.window_start < now() - p_window then now() else r.window_start end
  returning hits into v_hits;

  return v_hits <= p_max;
end;
$$;

revoke all on function public.hit_rate_limit(text, uuid, int, interval) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, uuid, int, interval) to service_role;
