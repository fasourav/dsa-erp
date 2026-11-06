-- v1.1.2: Dashboard Cash Balance KPI excludes bank opening balances
-- (value, MoM delta, and sparkline via public.dashboard_scope).
-- Keeps the v1.1.1 exclusion of manual deposit/withdrawal. The KPI is adjusted
-- cash movement, not spendable balance, and may be negative while Banking is positive.
-- Banking ledger, statements, reconciliation, overdraft checks, and stored
-- opening_balance values are unchanged. No data is rewritten.

create or replace function private.dashboard_cash(p_as_of date)
returns numeric
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select coalesce((
    select sum(case when direction = 'inflow' then amount else -amount end)
    from public.bank_transactions
    where transaction_date <= p_as_of
      and source_kind is not null
      and source_kind not in ('deposit', 'withdrawal')
      and direction in ('inflow', 'outflow')
  ), 0);
$$;

revoke all on function private.dashboard_cash(date) from public, anon, authenticated;
