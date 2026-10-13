-- Review fixes for money integrity, bank reconciliation, and attachment rows.
-- This file is not applied by the app. Apply it with the normal migration flow.
--
-- 1. Auto-match compared the bank_flow_direction enum with the text direction on a
--    statement line. Postgres has no such operator, so every auto-match with an
--    unmatched line failed.
-- 2. Transfer deletes used one transaction-wide flag. After the first transfer in a
--    transaction, later transfers kept their other leg. The flag now names the transfer.
-- 3. The negative-balance guard read the balance without a lock, so two outflows that
--    committed together could both pass. Changes that can lower a balance now lock the
--    account first. People without Show Financials no longer see the balance in the error.
-- 4. Invoice and payment caps were only checked by the app before writing. The project
--    cap now locks the project, and payments cannot exceed their invoice.
-- 5. Statement lines can only match a transaction in the same account. Reconciliations
--    cannot cover dates that have not happened yet, and overlapping saves are serialized.
-- 6. Editing an employee without Show Financials keeps the stored salary and allowance.
-- 7. Attachment rows keep the creator, a path inside their parent's folder, and only
--    the file name can change.

-- 1 -------------------------------------------------------------------------

create or replace function public.auto_match_bank_statement(
  p_account uuid,
  p_from date,
  p_to date,
  p_days integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  line record;
  candidate uuid;
  candidate_count integer;
  matched integer := 0;
begin
  if auth.uid() is null
    or not private.sees_financials()
    or not private.can('banking', 'edit')
  then
    raise exception 'You do not have access to reconcile this account.';
  end if;
  if not exists (select 1 from public.bank_match_tolerances where days = p_days) then
    raise exception 'Choose a match tolerance from the list.';
  end if;
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'Choose a valid period.';
  end if;

  for line in
    select *
    from public.bank_statement_lines
    where bank_account_id = p_account
      and line_date between p_from and p_to
      and bank_transaction_id is null
      and not private.bank_date_locked(bank_account_id, line_date)
    order by line_date, id
  loop
    select count(*), (array_agg(bt.id))[1]
    into candidate_count, candidate
    from public.bank_transactions bt
    where bt.bank_account_id = p_account
      and bt.direction::text = line.direction
      and bt.amount = line.amount
      and abs(bt.transaction_date - line.line_date) <= p_days
      and not exists (
        select 1 from public.bank_statement_lines taken
        where taken.bank_transaction_id = bt.id
      )
      and not private.bank_date_locked(bt.bank_account_id, bt.transaction_date);

    if candidate_count = 1 and candidate is not null then
      update public.bank_statement_lines
      set bank_transaction_id = candidate
      where id = line.id
        and bank_transaction_id is null;
      if found then
        matched := matched + 1;
      end if;
    end if;
  end loop;

  return matched;
end;
$$;

-- 2 -------------------------------------------------------------------------

create or replace function public.delete_transfer_legs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('dsa.deleting_transfer', true) = old.id::text then
    return old;
  end if;

  perform set_config('dsa.deleting_transfer', old.id::text, true);
  delete from public.bank_transactions where transfer_id = old.id;
  perform set_config('dsa.deleting_transfer', '', true);
  return old;
end;
$$;

create or replace function public.delete_transfer_from_leg()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.transfer_id is null
    or current_setting('dsa.deleting_transfer', true) = old.transfer_id::text
  then
    return old;
  end if;

  perform set_config('dsa.deleting_transfer', old.transfer_id::text, true);
  delete from public.bank_transactions
  where transfer_id = old.transfer_id
    and id <> old.id;
  delete from public.bank_transfers where id = old.transfer_id;
  perform set_config('dsa.deleting_transfer', '', true);
  return old;
end;
$$;

-- 3 -------------------------------------------------------------------------

-- NO KEY UPDATE serializes balance checks without blocking the foreign-key share
-- locks that every new bank transaction takes on its account.
create or replace function private.lock_bank_account(account uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if account is null then
    return;
  end if;
  perform 1 from public.bank_accounts where id = account for no key update;
end;
$$;

create or replace function private.assert_account_balance(account uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  balance numeric;
  new_effect numeric;
  available numeric;
  needed numeric;
  account_name text;
begin
  if account is null then
    return;
  end if;

  select
    a.opening_balance + coalesce(sum(
      case
        when t.direction = 'inflow' then t.amount
        else -t.amount
      end
    ), 0),
    coalesce(sum(
      case
        when t.xmin = pg_current_xact_id()::xid then
          case
            when t.direction = 'inflow' then t.amount
            else -t.amount
          end
        else 0
      end
    ), 0),
    a.name
  into balance, new_effect, account_name
  from public.bank_accounts a
  left join public.bank_transactions t on t.bank_account_id = a.id
  where a.id = account
  group by a.opening_balance, a.name;

  if coalesce(balance, 0) >= 0 then
    return;
  end if;

  available := coalesce(balance, 0) - coalesce(new_effect, 0);
  needed := available - coalesce(balance, 0);
  if needed <= 0 then
    needed := -coalesce(balance, 0);
  end if;
  if available < 0 then
    available := 0;
  end if;

  raise exception 'INSUFFICIENT_BALANCE'
    using
      errcode = '23514',
      detail = coalesce(nullif(btrim(account_name), ''), 'this account'),
      hint = case
        when private.sees_financials() then
          trim(to_char(available, 'FM999999999990.00'))
            || ','
            || trim(to_char(needed, 'FM999999999990.00'))
        else ''
      end;
end;
$$;

-- Only changes that can lower a balance take the lock. Inflow legs of a transfer stay
-- unlocked, so two opposite transfers committing together cannot deadlock.
create or replace function private.guard_bank_balance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.direction = 'inflow' then
      perform private.lock_bank_account(old.bank_account_id);
    end if;
    perform private.assert_account_balance(old.bank_account_id);
    return old;
  end if;

  if new.direction = 'outflow' or (tg_op = 'UPDATE' and old.direction = 'inflow') then
    perform private.lock_bank_account(new.bank_account_id);
  end if;
  perform private.assert_account_balance(new.bank_account_id);

  if tg_op = 'UPDATE' and old.bank_account_id is distinct from new.bank_account_id then
    if old.direction = 'inflow' then
      perform private.lock_bank_account(old.bank_account_id);
    end if;
    perform private.assert_account_balance(old.bank_account_id);
  end if;
  return new;
end;
$$;

-- 4 -------------------------------------------------------------------------

create or replace function private.guard_client_invoice_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_value numeric;
  billed numeric;
begin
  if new.status = 'void' then
    return new;
  end if;

  select p.total_value
  into project_value
  from public.projects p
  where p.id = new.project_id
  for no key update;

  select coalesce(sum(i.amount), 0)
  into billed
  from public.client_invoices i
  where i.project_id = new.project_id
    and i.id is distinct from new.id
    and i.status is distinct from 'void';

  if coalesce(project_value, 0) < billed + new.amount then
    raise exception 'Invoices for this project cannot exceed the project value.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function private.guard_client_payment_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  invoice_amount numeric;
  paid numeric;
begin
  if tg_op = 'UPDATE'
    and new.client_invoice_id = old.client_invoice_id
    and new.amount <= old.amount
  then
    return new;
  end if;

  select i.amount
  into invoice_amount
  from public.client_invoices i
  where i.id = new.client_invoice_id
  for no key update;

  if not found then
    return new;
  end if;

  select coalesce(sum(p.amount), 0)
  into paid
  from public.client_payments p
  where p.client_invoice_id = new.client_invoice_id
    and p.id is distinct from new.id;

  if round(paid + new.amount, 2) > round(invoice_amount, 2) then
    raise exception 'Payment is more than the amount still due.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function private.guard_vendor_payment_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  invoice_amount numeric;
  paid numeric;
begin
  if tg_op = 'UPDATE'
    and new.vendor_invoice_id = old.vendor_invoice_id
    and new.amount <= old.amount
  then
    return new;
  end if;

  select i.amount
  into invoice_amount
  from public.vendor_invoices i
  where i.id = new.vendor_invoice_id
  for no key update;

  if not found then
    return new;
  end if;

  select coalesce(sum(p.amount), 0)
  into paid
  from public.vendor_payments p
  where p.vendor_invoice_id = new.vendor_invoice_id
    and p.id is distinct from new.id;

  if round(paid + new.amount, 2) > round(invoice_amount, 2) then
    raise exception 'Payment is more than the amount still due.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists client_payments_invoice_cap on public.client_payments;
create trigger client_payments_invoice_cap
  before insert or update of amount, client_invoice_id on public.client_payments
  for each row execute function private.guard_client_payment_cap();

drop trigger if exists vendor_payments_invoice_cap on public.vendor_payments;
create trigger vendor_payments_invoice_cap
  before insert or update of amount, vendor_invoice_id on public.vendor_payments
  for each row execute function private.guard_vendor_payment_cap();

-- 5 -------------------------------------------------------------------------

create or replace function private.guard_statement_line()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if private.bank_date_locked(old.bank_account_id, old.line_date) then
      raise exception 'This period is reconciled and locked.';
    end if;
    return old;
  end if;
  if private.bank_date_locked(new.bank_account_id, new.line_date) then
    raise exception 'This period is reconciled and locked.';
  end if;
  if tg_op = 'UPDATE' and private.bank_date_locked(old.bank_account_id, old.line_date) then
    raise exception 'This period is reconciled and locked.';
  end if;
  if new.bank_transaction_id is not null and not exists (
    select 1
    from public.bank_transactions t
    where t.id = new.bank_transaction_id
      and t.bank_account_id = new.bank_account_id
  ) then
    raise exception 'Match a transaction from the same account.';
  end if;
  return new;
end;
$$;

create or replace function private.fill_bank_reconciliation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
    or not private.sees_financials()
    or not private.can('banking', 'edit')
  then
    raise exception 'You do not have access to reconcile this account.';
  end if;
  if new.period_end > (now() at time zone 'Asia/Dhaka')::date then
    raise exception 'A reconciliation cannot end after today.';
  end if;

  perform private.lock_bank_account(new.bank_account_id);

  if exists (
    select 1
    from public.bank_reconciliations r
    where r.bank_account_id = new.bank_account_id
      and daterange(r.period_start, r.period_end, '[]')
        && daterange(new.period_start, new.period_end, '[]')
      and r.id is distinct from new.id
  ) then
    raise exception 'This period overlaps a reconciliation that is already locked.';
  end if;
  new.book_balance := private.account_book_balance(new.bank_account_id, new.period_end);
  new.difference := new.statement_balance - new.book_balance;
  new.reconciled_by := auth.uid();
  new.reconciled_at := now();
  return new;
end;
$$;

-- 6 -------------------------------------------------------------------------

create or replace function private.guard_employee_pay()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and not private.sees_financials() then
    new.monthly_salary := old.monthly_salary;
    new.allowance := old.allowance;
  end if;
  return new;
end;
$$;

drop trigger if exists employees_keep_pay on public.employees;
create trigger employees_keep_pay
  before update of monthly_salary, allowance on public.employees
  for each row execute function private.guard_employee_pay();

-- 7 -------------------------------------------------------------------------

create or replace function private.stamp_attachment_creator()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists record_attachments_creator on public.record_attachments;
create trigger record_attachments_creator
  before insert on public.record_attachments
  for each row execute function private.stamp_attachment_creator();

-- A uuid is 36 characters, plus the two slashes around it.
alter table public.record_attachments
  drop constraint if exists record_attachments_path_in_parent;
alter table public.record_attachments
  add constraint record_attachments_path_in_parent check (
    left(storage_path, length(parent_type) + 38) = parent_type || '/' || parent_id::text || '/'
  );

revoke update on table public.record_attachments from authenticated;
grant update (file_name) on table public.record_attachments to authenticated;

-- ---------------------------------------------------------------------------

revoke all on function private.lock_bank_account(uuid) from public, anon, authenticated;
revoke all on function private.assert_account_balance(uuid) from public, anon;
revoke all on function private.guard_bank_balance() from public, anon;
revoke all on function private.guard_client_invoice_cap() from public, anon;
revoke all on function private.guard_client_payment_cap() from public, anon, authenticated;
revoke all on function private.guard_vendor_payment_cap() from public, anon, authenticated;
revoke all on function private.guard_statement_line() from public, anon;
revoke all on function private.fill_bank_reconciliation() from public, anon;
revoke all on function private.guard_employee_pay() from public, anon, authenticated;
revoke all on function private.stamp_attachment_creator() from public, anon, authenticated;
revoke all on function public.delete_transfer_legs() from public, anon;
revoke all on function public.delete_transfer_from_leg() from public, anon;
revoke all on function public.auto_match_bank_statement(uuid, date, date, integer) from public, anon;
grant execute on function public.auto_match_bank_statement(uuid, date, date, integer) to authenticated;
