-- Vendor costs belong on a purchase order, then a vendor bill, then a vendor payment.
-- public.operational_expenses is a base table, not a view, so this trigger is on that table.
-- Existing rows are not updated or deleted. A row that already has vendor_id can still
-- be edited when vendor_id stays the same. Inserts, and updates that set or change
-- vendor_id, are rejected.
--
-- created_by is added without a volatile default in the same statement. auth.uid() is
-- volatile, so ADD COLUMN ... DEFAULT auth.uid() would stamp every existing row.
-- Existing created_by values stay null. New inserts default to auth.uid().

alter table public.operational_expenses
  add column if not exists created_by uuid;

alter table public.vendor_payments
  add column if not exists created_by uuid;

alter table public.operational_expenses
  alter column created_by set default auth.uid();

alter table public.vendor_payments
  alter column created_by set default auth.uid();

comment on column public.operational_expenses.created_by is
  'User who created the row. Null on rows that existed before this column.';

comment on column public.vendor_payments.created_by is
  'User who created the row. Null on rows that existed before this column.';

create or replace function private.reject_operational_expense_vendor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.vendor_id is not null
     and (
       tg_op = 'INSERT'
       or old.vendor_id is distinct from new.vendor_id
     ) then
    raise exception 'Vendor costs go through an Operational Purchase Order, then a vendor bill and a vendor payment.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists operational_expenses_reject_vendor on public.operational_expenses;
create trigger operational_expenses_reject_vendor
  before insert or update on public.operational_expenses
  for each row execute function private.reject_operational_expense_vendor();

create or replace function private.stamp_created_by()
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

drop trigger if exists operational_expenses_stamp_created_by on public.operational_expenses;
create trigger operational_expenses_stamp_created_by
  before insert on public.operational_expenses
  for each row execute function private.stamp_created_by();

drop trigger if exists vendor_payments_stamp_created_by on public.vendor_payments;
create trigger vendor_payments_stamp_created_by
  before insert on public.vendor_payments
  for each row execute function private.stamp_created_by();

revoke all on function private.reject_operational_expense_vendor() from public, anon;
revoke all on function private.stamp_created_by() from public, anon;
grant execute on function private.reject_operational_expense_vendor() to authenticated, service_role;
grant execute on function private.stamp_created_by() to authenticated, service_role;

notify pgrst, 'reload schema';
