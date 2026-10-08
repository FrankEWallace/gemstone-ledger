-- 041: Transactions take their org's currency unless one is given.
--
-- transactions.currency defaulted to 'USD', and most insert paths (inventory
-- usage, contract income, CSV import) never set it, so shilling amounts were
-- stored labelled USD. The app displays every amount in the org currency, so
-- the label was wrong rather than the amounts.
--
-- Drops the default and fills a missing currency from the site's org in a
-- BEFORE INSERT trigger (it runs before the NOT NULL check).

alter table public.transactions alter column currency drop default;

create or replace function public.set_transaction_currency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.currency is null then
    select o.currency into new.currency
    from sites s join organizations o on o.id = s.org_id
    where s.id = new.site_id;
  end if;
  return new;
end;
$$;

revoke all on function public.set_transaction_currency() from public, anon, authenticated;

drop trigger if exists set_transaction_currency on public.transactions;
create trigger set_transaction_currency
  before insert on public.transactions
  for each row execute function public.set_transaction_currency();

-- Relabel existing rows. Checked 2026-10-08: the only org is TZS, and all 28
-- USD-labelled rows hold shilling magnitudes (100,000 to 68,520,000).
update public.transactions t
set currency = o.currency
from sites s join organizations o on o.id = s.org_id
where t.site_id = s.id
  and t.currency = 'USD'
  and o.currency = 'TZS';
