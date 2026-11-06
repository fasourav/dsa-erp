-- Dashboard cash = qualifying transactions only (no opening balances, no manual
-- deposit/withdrawal). Bank records untouched. TEST DB only; always rolls back.
-- psql -v ON_ERROR_STOP=1 -f supabase/tests/dashboard_cash_opening.sql
\set ON_ERROR_STOP on
begin;

do $$
declare
  v_before numeric := private.dashboard_cash('2999-12-31');
  v_account uuid;
  v_opening numeric;
begin
  insert into public.bank_accounts (
    name,
    opening_balance,
    account_holder_name,
    account_number,
    bank_name,
    routing_number,
    address
  )
  values (
    'zz v1.1.2 opening-only test',
    5000,
    'DSA Studio',
    '9999999999',
    'Test Bank',
    '123456789',
    'Dhaka'
  )
  returning id into v_account;

  if private.dashboard_cash('2999-12-31') <> v_before then
    raise exception 'opening-only account changed dashboard cash by %',
      private.dashboard_cash('2999-12-31') - v_before;
  end if;

  select opening_balance into v_opening from public.bank_accounts where id = v_account;
  if v_opening <> 5000 then
    raise exception 'bank opening balance must be unchanged';
  end if;

  insert into public.bank_transactions (bank_account_id, amount, direction, source_kind, transaction_date)
  values (v_account, 700, 'inflow', 'deposit', '2026-01-10'),
         (v_account, 300, 'outflow', 'withdrawal', '2026-01-11');
  if private.dashboard_cash('2999-12-31') <> v_before then
    raise exception 'manual deposit/withdrawal must stay excluded';
  end if;

  insert into public.bank_transactions (bank_account_id, amount, direction, source_kind, transaction_date)
  values (v_account, 1200, 'inflow', 'other', '2026-01-12');
  if private.dashboard_cash('2999-12-31') <> v_before + 1200 then
    raise exception 'qualifying inflow must count';
  end if;
  if private.dashboard_cash('2026-01-11') <> private.dashboard_cash('2026-01-11') then
    raise exception 'as-of must be deterministic';
  end if;
end $$;

rollback;
