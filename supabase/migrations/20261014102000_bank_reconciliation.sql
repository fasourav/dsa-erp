-- Bank reconciliation per account.
-- Match statement lines to the book, then lock a period.
-- Requires Show Financials and the banking module.
-- This file is not applied by the app. Apply it with the normal migration flow.

create schema if not exists private;

create table if not exists public.bank_match_tolerances (
  days integer primary key,
  label text not null,
  sort_order integer not null unique,
  constraint bank_match_tolerances_days_check check (days >= 0 and days <= 31)
);

insert into public.bank_match_tolerances (days, label, sort_order)
values
  (0, 'Same Day', 1),
  (1, '1 Day', 2),
  (3, '3 Days', 3),
  (7, '7 Days', 4)
on conflict (days) do update
set label = excluded.label, sort_order = excluded.sort_order;

create table if not exists public.bank_reconciliations (
  id uuid primary key default gen_random_uuid(),
  bank_account_id uuid not null references public.bank_accounts (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  statement_balance numeric(14, 2) not null,
  book_balance numeric(14, 2) not null,
  difference numeric(14, 2) not null,
  reconciled_at timestamptz not null default now(),
  reconciled_by uuid,
  constraint bank_reconciliations_period_check check (period_end >= period_start)
);

create index if not exists bank_reconciliations_account_idx
  on public.bank_reconciliations (bank_account_id, period_start, period_end);

create table if not exists public.bank_statement_lines (
  id uuid primary key default gen_random_uuid(),
  bank_account_id uuid not null references public.bank_accounts (id) on delete cascade,
  line_date date not null,
  description text not null default '',
  direction text not null,
  amount numeric(14, 2) not null,
  reference text not null default '',
  bank_transaction_id uuid unique references public.bank_transactions (id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid,
  constraint bank_statement_lines_direction_check check (direction in ('inflow', 'outflow')),
  constraint bank_statement_lines_amount_check check (amount > 0)
);

create index if not exists bank_statement_lines_account_date_idx
  on public.bank_statement_lines (bank_account_id, line_date);

create or replace function private.bank_date_locked(p_account uuid, p_day date)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_account is not null
    and p_day is not null
    and exists (
      select 1
      from public.bank_reconciliations r
      where r.bank_account_id = p_account
        and p_day between r.period_start and r.period_end
    );
$$;

create or replace function private.account_book_balance(p_account uuid, p_as_of date)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select opening_balance from public.bank_accounts where id = p_account), 0)
    + coalesce((
      select sum(case when direction = 'inflow' then amount else -amount end)
      from public.bank_transactions
      where bank_account_id = p_account
        and transaction_date <= p_as_of
    ), 0);
$$;

create or replace function private.guard_reconciled_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if private.bank_date_locked(old.bank_account_id, old.transaction_date) then
      raise exception 'This period is reconciled and locked.';
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' then
    if private.bank_date_locked(old.bank_account_id, old.transaction_date)
      or private.bank_date_locked(new.bank_account_id, new.transaction_date)
    then
      raise exception 'This period is reconciled and locked.';
    end if;
    return new;
  end if;
  if private.bank_date_locked(new.bank_account_id, new.transaction_date) then
    raise exception 'This period is reconciled and locked.';
  end if;
  return new;
end;
$$;

drop trigger if exists bank_transactions_reconciled on public.bank_transactions;
create trigger bank_transactions_reconciled
  before insert or update or delete on public.bank_transactions
  for each row execute function private.guard_reconciled_transaction();

create or replace function private.guard_statement_line()
returns trigger
language plpgsql
security definer
set search_path = public
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
  return new;
end;
$$;

drop trigger if exists bank_statement_lines_locked on public.bank_statement_lines;
create trigger bank_statement_lines_locked
  before insert or update or delete on public.bank_statement_lines
  for each row execute function private.guard_statement_line();

create or replace function private.fill_bank_reconciliation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null
    or not private.sees_financials()
    or not private.can('banking', 'edit')
  then
    raise exception 'You do not have access to reconcile this account.';
  end if;
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

drop trigger if exists bank_reconciliations_fill on public.bank_reconciliations;
create trigger bank_reconciliations_fill
  before insert on public.bank_reconciliations
  for each row execute function private.fill_bank_reconciliation();

create or replace function public.auto_match_bank_statement(
  p_account uuid,
  p_from date,
  p_to date,
  p_days integer
)
returns integer
language plpgsql
security definer
set search_path = public
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
      and bt.direction = line.direction
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

create or replace function private.log_bank_reconcile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  row_data jsonb;
  verb text;
  label text;
begin
  begin
    if tg_op = 'DELETE' then
      verb := 'delete';
      row_data := to_jsonb(old);
    elsif tg_op = 'UPDATE' then
      verb := 'update';
      row_data := to_jsonb(new);
    else
      verb := 'insert';
      row_data := to_jsonb(new);
    end if;
    label := coalesce(nullif(btrim(row_data->>'description'), ''), nullif(btrim(row_data->>'period_start'), ''), 'Reconciliation');
    insert into public.activity_log (
      actor_id, action, module, table_name, record_id, record_label, summary, old_values, new_values
    )
    values (
      auth.uid(),
      verb,
      'banking',
      tg_table_name,
      row_data->>'id',
      label,
      case verb
        when 'insert' then 'Added'
        when 'update' then 'Updated'
        else 'Deleted'
      end || ' ' || label,
      case when verb = 'insert' then null else to_jsonb(old) end,
      case when verb = 'delete' then null else row_data end
    );
  exception
    when others then
      null;
  end;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists bank_statement_lines_activity on public.bank_statement_lines;
create trigger bank_statement_lines_activity
  after insert or update or delete on public.bank_statement_lines
  for each row execute function private.log_bank_reconcile();

drop trigger if exists bank_reconciliations_activity on public.bank_reconciliations;
create trigger bank_reconciliations_activity
  after insert or delete on public.bank_reconciliations
  for each row execute function private.log_bank_reconcile();

alter table public.bank_match_tolerances enable row level security;
alter table public.bank_statement_lines enable row level security;
alter table public.bank_reconciliations enable row level security;

drop policy if exists bank_match_tolerances_select on public.bank_match_tolerances;
create policy bank_match_tolerances_select on public.bank_match_tolerances
  for select to authenticated
  using (private.sees_financials() and private.can('banking', 'view'));

drop policy if exists bank_statement_lines_select on public.bank_statement_lines;
create policy bank_statement_lines_select on public.bank_statement_lines
  for select to authenticated
  using (private.sees_financials() and private.can('banking', 'view'));

drop policy if exists bank_statement_lines_insert on public.bank_statement_lines;
create policy bank_statement_lines_insert on public.bank_statement_lines
  for insert to authenticated
  with check (private.sees_financials() and private.can('banking', 'edit'));

drop policy if exists bank_statement_lines_update on public.bank_statement_lines;
create policy bank_statement_lines_update on public.bank_statement_lines
  for update to authenticated
  using (private.sees_financials() and private.can('banking', 'edit'))
  with check (private.sees_financials() and private.can('banking', 'edit'));

drop policy if exists bank_statement_lines_delete on public.bank_statement_lines;
create policy bank_statement_lines_delete on public.bank_statement_lines
  for delete to authenticated
  using (private.sees_financials() and private.can('banking', 'delete'));

drop policy if exists bank_reconciliations_select on public.bank_reconciliations;
create policy bank_reconciliations_select on public.bank_reconciliations
  for select to authenticated
  using (private.sees_financials() and private.can('banking', 'view'));

drop policy if exists bank_reconciliations_insert on public.bank_reconciliations;
create policy bank_reconciliations_insert on public.bank_reconciliations
  for insert to authenticated
  with check (private.sees_financials() and private.can('banking', 'edit'));

revoke all on table public.bank_match_tolerances from anon, public;
revoke all on table public.bank_statement_lines from anon, public;
revoke all on table public.bank_reconciliations from anon, public;
grant select on public.bank_match_tolerances to authenticated;
grant select, insert, update, delete on public.bank_statement_lines to authenticated;
grant select, insert on public.bank_reconciliations to authenticated;

revoke all on function private.bank_date_locked(uuid, date) from public, anon, authenticated;
revoke all on function private.account_book_balance(uuid, date) from public, anon, authenticated;
revoke all on function private.guard_reconciled_transaction() from public, anon, authenticated;
revoke all on function private.guard_statement_line() from public, anon, authenticated;
revoke all on function private.fill_bank_reconciliation() from public, anon, authenticated;
revoke all on function private.log_bank_reconcile() from public, anon, authenticated;
revoke all on function public.auto_match_bank_statement(uuid, date, date, integer) from public, anon;
grant execute on function public.auto_match_bank_statement(uuid, date, date, integer) to authenticated;
