-- v1.4.2: Dashboard "Current Balance" = the Banking balance.
-- Sum of every bank account's opening balance plus every bank entry
-- (inflow minus outflow) on or before p_as_of, including manual deposits,
-- withdrawals, transfers and payroll. Entries with no bank account are
-- skipped, like the Banking page. Opening balances have no date, so they are
-- always included, like Banking, statements and reconciliation.
-- Replaces the v1.1.1/v1.1.2 "adjusted cash" rule. No data is rewritten.
--
-- Rollback (restores the v1.1.2 rule exactly):
--   create or replace function private.dashboard_cash(p_as_of date)
--   returns numeric language sql stable security invoker
--   set search_path = public, pg_temp as $$
--     select coalesce((
--       select sum(case when direction = 'inflow' then amount else -amount end)
--       from public.bank_transactions
--       where transaction_date <= p_as_of
--         and source_kind is not null
--         and source_kind not in ('deposit', 'withdrawal')
--         and direction in ('inflow', 'outflow')
--     ), 0);
--   $$;
--   revoke all on function private.dashboard_cash(date) from public, anon, authenticated;

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
        and bank_account_id is not null
        and direction in ('inflow', 'outflow')
    ), 0);
$$;

revoke all on function private.dashboard_cash(date) from public, anon, authenticated;
