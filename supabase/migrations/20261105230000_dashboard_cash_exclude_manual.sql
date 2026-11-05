-- Exclude manual bank deposits and withdrawals from the Dashboard Cash Balance KPI
-- (value, MoM delta, and sparkline series via public.dashboard_scope).
-- Banking ledger, statements, reconciliations, and opening balances stay unchanged.

create or replace function private.dashboard_cash(p_as_of date)
returns numeric
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select coalesce((select sum(opening_balance) from public.bank_accounts), 0)
    + coalesce((
      select sum(case when direction = 'inflow' then amount else -amount end)
      from public.bank_transactions
      where transaction_date <= p_as_of
        and source_kind is not null
        and source_kind not in ('deposit', 'withdrawal')
        and direction in ('inflow', 'outflow')
    ), 0);
$$;

revoke all on function private.dashboard_cash(date) from public, anon, authenticated;
