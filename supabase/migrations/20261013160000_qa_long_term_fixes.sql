-- Long-term fixes for the QA bug list. Apply in order with the other
-- migrations. This file is not applied to production by the change that adds it.
--
-- BUG-001  Hide salary, allowance, and bank balances unless Show Financials.
-- BUG-003  Block invoice delete while payments exist.
-- BUG-004  Reject a bank movement that would make the balance negative.
-- BUG-005  Catalog foreign keys restrict delete; drop the copied department name.
-- BUG-006  Invoice status is derived from payments, including partial.
-- BUG-007  Invoice totals cannot exceed the project value.
-- BUG-009  Lead date, project start, and budget year are on or after 2021-01-01.
-- BUG-010  Case-insensitive unique names for clients, vendors, and catalogs.
-- BUG-011  Lead email and phone checks.
-- BUG-012  Project value, purchase-order value, and whole asset quantities.
-- BUG-013  Vendor payment date is on or after the purchase-order date.
-- BUG-019  Leave date cannot precede the joining date (constraint already exists;
--          the message is stable for the app).
-- BUG-020  Vendor invoice rows require Vendor Payments; purchase-order totals
--          stay available through vendor_po_balances.
-- BUG-021  Asset categories are a settings catalog.
-- SEC-02   New profiles take their role from user_invites, never user metadata.

-- ---------------------------------------------------------------------------
-- SEC-02. Role comes from an owner-written invite row.
-- ---------------------------------------------------------------------------

create table if not exists public.user_invites (
  email text primary key,
  role text not null,
  show_financials boolean not null default false,
  display_name text,
  created_at timestamptz not null default now(),
  constraint user_invites_role_check
    check (role in ('owner', 'accountant', 'staff', 'custom'))
);

alter table public.user_invites enable row level security;

drop policy if exists user_invites_select on public.user_invites;
create policy user_invites_select on public.user_invites
  for select to authenticated using (private.is_owner());

drop policy if exists user_invites_insert on public.user_invites;
create policy user_invites_insert on public.user_invites
  for insert to authenticated with check (private.is_owner());

drop policy if exists user_invites_update on public.user_invites;
create policy user_invites_update on public.user_invites
  for update to authenticated
  using (private.is_owner())
  with check (private.is_owner());

drop policy if exists user_invites_delete on public.user_invites;
create policy user_invites_delete on public.user_invites
  for delete to authenticated using (private.is_owner());

grant select, insert, update, delete on public.user_invites to authenticated;

create or replace function private.handle_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invite public.user_invites%rowtype;
  next_role text;
  next_financials boolean;
  next_name text;
begin
  if tg_op = 'INSERT' then
    select *
    into invite
    from public.user_invites
    where email = lower(new.email);

    next_role := coalesce(invite.role, 'staff');
    if next_role not in ('owner', 'accountant', 'staff', 'custom') then
      next_role := 'staff';
    end if;
    next_financials := coalesce(invite.show_financials, false);
    next_name := nullif(btrim(invite.display_name), '');

    insert into public.profiles (
      id,
      email,
      display_name,
      role,
      status,
      show_financials,
      last_sign_in_at
    )
    values (
      new.id,
      new.email,
      next_name,
      next_role,
      case when new.last_sign_in_at is null then 'invited' else 'active' end,
      next_financials,
      new.last_sign_in_at
    )
    on conflict (id) do update
    set email = excluded.email,
        last_sign_in_at = excluded.last_sign_in_at;

    delete from public.user_invites where email = lower(new.email);

    return new;
  end if;

  update public.profiles
  set
    email = new.email,
    last_sign_in_at = new.last_sign_in_at,
    status = case
      when status = 'invited' and new.last_sign_in_at is not null then 'active'
      else status
    end
  where id = new.id;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- BUG-001. Show Financials is enforced for salary and bank figures.
-- ---------------------------------------------------------------------------

create or replace function private.sees_financials()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.status <> 'deactivated'
      and p.show_financials
  );
$$;

revoke all on function private.sees_financials() from public, anon, authenticated;

create or replace view public.employees_readable
with (security_invoker = false) as
select
  e.id,
  e.full_name,
  e.department_id,
  d.name as department,
  e.designation,
  case when private.sees_financials() then e.monthly_salary else null end as monthly_salary,
  case when private.sees_financials() then e.allowance else null end as allowance,
  e.email,
  e.phone,
  e.joining_date,
  e.leave_date,
  e.is_active,
  e.notes,
  e.created_at,
  e.updated_at
from public.employees e
left join public.departments d on d.id = e.department_id
where private.can('employees', 'view')
   or private.can('payroll', 'view')
   or private.can('budgets', 'view');

create or replace view public.bank_accounts_readable
with (security_invoker = false) as
select
  a.id,
  a.name,
  a.account_holder_name,
  a.account_number,
  a.bank_name,
  a.routing_number,
  a.address,
  case when private.sees_financials() then a.opening_balance else null end as opening_balance,
  a.currency,
  a.is_active,
  a.sort_order,
  a.created_at
from public.bank_accounts a
where private.can('banking', 'view')
   or private.can('dashboard', 'view');

create or replace view public.bank_transactions_readable
with (security_invoker = false) as
select
  t.id,
  t.bank_account_id,
  t.transaction_date,
  t.created_at,
  t.direction,
  case when private.sees_financials() then t.amount else null end as amount,
  t.source_kind,
  t.payment_method,
  t.project_id,
  t.notes,
  t.income_id,
  t.vendor_payment_id,
  t.operational_expense_id,
  t.vat_tax_payment_id,
  t.payroll_line_id,
  t.transfer_id
from public.bank_transactions t
where private.can('banking', 'view')
   or private.can('dashboard', 'view');

grant select on public.employees_readable to authenticated;
grant select on public.bank_accounts_readable to authenticated;
grant select on public.bank_transactions_readable to authenticated;

revoke select on public.employees from authenticated, anon;
grant select (
  id,
  full_name,
  department_id,
  designation,
  email,
  phone,
  joining_date,
  leave_date,
  is_active,
  notes,
  created_at,
  updated_at
) on public.employees to authenticated;

revoke select on public.bank_accounts from authenticated, anon;
grant select (
  id,
  name,
  account_holder_name,
  account_number,
  bank_name,
  routing_number,
  address,
  currency,
  is_active,
  sort_order,
  created_at
) on public.bank_accounts to authenticated;

revoke select on public.bank_transactions from authenticated, anon;
grant select (
  id,
  bank_account_id,
  transaction_date,
  created_at,
  direction,
  source_kind,
  payment_method,
  project_id,
  notes,
  income_id,
  vendor_payment_id,
  operational_expense_id,
  vat_tax_payment_id,
  payroll_line_id,
  transfer_id
) on public.bank_transactions to authenticated;

create or replace view public.bank_transaction_details
with (security_invoker = false) as
select
  bt.id,
  bt.direction,
  bt.source_kind,
  bt.transaction_date,
  case when private.sees_financials() then bt.amount else null end::numeric(14, 2) as amount,
  bt.payment_method,
  bt.income_id,
  bt.vendor_payment_id,
  bt.operational_expense_id,
  bt.vat_tax_payment_id,
  bt.project_id,
  p.name as project_name,
  ba.name as bank_account_name,
  bt.notes,
  bt.created_at
from public.bank_transactions bt
left join public.projects p on p.id = bt.project_id
left join public.bank_accounts ba on ba.id = bt.bank_account_id
where private.can('banking', 'view');

grant select on public.bank_transaction_details to authenticated;

-- ---------------------------------------------------------------------------
-- BUG-003. An invoice with payments cannot be deleted.
-- ---------------------------------------------------------------------------

alter table public.client_payments
  drop constraint client_payments_client_invoice_id_fkey;

alter table public.client_payments
  add constraint client_payments_client_invoice_id_fkey
  foreign key (client_invoice_id)
  references public.client_invoices (id)
  on delete restrict;

-- ---------------------------------------------------------------------------
-- BUG-004. Balance cannot go negative.
-- ---------------------------------------------------------------------------

create or replace function private.assert_account_balance(account uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  balance numeric;
begin
  if account is null then
    return;
  end if;

  select a.opening_balance + coalesce(sum(
    case
      when t.direction = 'inflow' then t.amount
      else -t.amount
    end
  ), 0)
  into balance
  from public.bank_accounts a
  left join public.bank_transactions t on t.bank_account_id = a.id
  where a.id = account
  group by a.opening_balance;

  if coalesce(balance, 0) < 0 then
    raise exception 'This would make the bank balance negative.'
      using errcode = '23514';
  end if;
end;
$$;

create or replace function private.guard_bank_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform private.assert_account_balance(old.bank_account_id);
    return old;
  end if;

  perform private.assert_account_balance(new.bank_account_id);
  if tg_op = 'UPDATE' and old.bank_account_id is distinct from new.bank_account_id then
    perform private.assert_account_balance(old.bank_account_id);
  end if;
  return new;
end;
$$;

drop trigger if exists bank_transactions_non_negative on public.bank_transactions;
create constraint trigger bank_transactions_non_negative
  after insert or update or delete on public.bank_transactions
  deferrable initially deferred
  for each row
  execute function private.guard_bank_balance();

-- ---------------------------------------------------------------------------
-- BUG-005. In-use catalog rows cannot be deleted. Department name is not copied.
-- ---------------------------------------------------------------------------

alter table public.employees
  drop constraint if exists employees_department_id_fkey;

alter table public.employees
  add constraint employees_department_id_fkey
  foreign key (department_id)
  references public.departments (id)
  on delete restrict;

alter table public.operational_expenses
  drop constraint if exists operational_expenses_department_id_fkey;

alter table public.operational_expenses
  add constraint operational_expenses_department_id_fkey
  foreign key (department_id)
  references public.departments (id)
  on delete restrict;

create or replace view public.employee_details
with (security_invoker = true) as
select
  e.id,
  e.full_name,
  d.name as department,
  e.designation,
  e.joining_date,
  e.leave_date,
  e.is_active,
  greatest(
    0::numeric,
    extract(year from age(coalesce(e.leave_date, current_date)::timestamp with time zone, e.joining_date::timestamp with time zone)) * 12::numeric
      + extract(month from age(coalesce(e.leave_date, current_date)::timestamp with time zone, e.joining_date::timestamp with time zone))
  )::integer as active_months,
  e.phone,
  e.email,
  e.notes,
  e.created_at
from public.employees e
left join public.departments d on d.id = e.department_id;

alter table public.employees drop column if exists department;

-- ---------------------------------------------------------------------------
-- BUG-006. Paid, partially paid, and unpaid come from the payments.
-- ---------------------------------------------------------------------------

create or replace function private.derived_payment_status(bill numeric, paid numeric)
returns public.payment_status
language sql
immutable
as $$
  select case
    when round(coalesce(paid, 0) * 100) <= 0 then 'unpaid'::public.payment_status
    when round(coalesce(paid, 0) * 100) >= round(coalesce(bill, 0) * 100) then 'paid'::public.payment_status
    else 'partial'::public.payment_status
  end;
$$;

alter table public.client_invoices
  drop constraint if exists client_invoices_status_paid_unpaid;

alter table public.client_invoices
  add constraint client_invoices_status_paid_unpaid
  check (status in ('unpaid', 'partial', 'paid', 'void'));

create or replace function private.sync_client_invoice_status(invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  bill numeric;
  paid numeric;
  current_status public.payment_status;
  next_status public.payment_status;
begin
  select amount, status
  into bill, current_status
  from public.client_invoices
  where id = invoice_id;

  if bill is null or current_status = 'void' then
    return;
  end if;

  select coalesce(sum(amount), 0)
  into paid
  from public.client_payments
  where client_invoice_id = invoice_id;

  next_status := private.derived_payment_status(bill, paid);
  if next_status is distinct from current_status then
    update public.client_invoices
    set status = next_status
    where id = invoice_id;
  end if;
end;
$$;

create or replace function private.client_invoices_apply_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  paid numeric;
begin
  if new.status = 'void' then
    return new;
  end if;

  select coalesce(sum(amount), 0)
  into paid
  from public.client_payments
  where client_invoice_id = new.id;

  new.status := private.derived_payment_status(new.amount, paid);
  return new;
end;
$$;

create or replace function private.client_payments_apply_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform private.sync_client_invoice_status(old.client_invoice_id);
    return old;
  end if;

  perform private.sync_client_invoice_status(new.client_invoice_id);
  if tg_op = 'UPDATE' and old.client_invoice_id is distinct from new.client_invoice_id then
    perform private.sync_client_invoice_status(old.client_invoice_id);
  end if;
  return new;
end;
$$;

drop trigger if exists client_invoices_apply_status on public.client_invoices;
create trigger client_invoices_apply_status
  before insert or update of amount, status on public.client_invoices
  for each row
  execute function private.client_invoices_apply_status();

drop trigger if exists client_payments_apply_status on public.client_payments;
create trigger client_payments_apply_status
  after insert or update or delete on public.client_payments
  for each row
  execute function private.client_payments_apply_status();

update public.client_invoices ci
set status = private.derived_payment_status(
  ci.amount,
  coalesce((select sum(cp.amount) from public.client_payments cp where cp.client_invoice_id = ci.id), 0)
)
where ci.status is distinct from 'void';

create or replace function private.sync_vendor_invoice_status(invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  bill numeric;
  paid numeric;
  current_status public.payment_status;
  next_status public.payment_status;
begin
  select amount, status
  into bill, current_status
  from public.vendor_invoices
  where id = invoice_id;

  if bill is null or current_status = 'void' then
    return;
  end if;

  select coalesce(sum(amount), 0)
  into paid
  from public.vendor_payments
  where vendor_invoice_id = invoice_id;

  next_status := private.derived_payment_status(bill, paid);
  if next_status is distinct from current_status then
    update public.vendor_invoices
    set status = next_status
    where id = invoice_id;
  end if;
end;
$$;

create or replace function private.vendor_invoices_apply_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  paid numeric;
begin
  if new.status = 'void' then
    return new;
  end if;

  select coalesce(sum(amount), 0)
  into paid
  from public.vendor_payments
  where vendor_invoice_id = new.id;

  new.status := private.derived_payment_status(new.amount, paid);
  return new;
end;
$$;

create or replace function private.vendor_payments_apply_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform private.sync_vendor_invoice_status(old.vendor_invoice_id);
    return old;
  end if;

  perform private.sync_vendor_invoice_status(new.vendor_invoice_id);
  if tg_op = 'UPDATE' and old.vendor_invoice_id is distinct from new.vendor_invoice_id then
    perform private.sync_vendor_invoice_status(old.vendor_invoice_id);
  end if;
  return new;
end;
$$;

drop trigger if exists vendor_invoices_apply_status on public.vendor_invoices;
create trigger vendor_invoices_apply_status
  before insert or update of amount, status on public.vendor_invoices
  for each row
  execute function private.vendor_invoices_apply_status();

drop trigger if exists vendor_payments_apply_status on public.vendor_payments;
create trigger vendor_payments_apply_status
  after insert or update or delete on public.vendor_payments
  for each row
  execute function private.vendor_payments_apply_status();

update public.vendor_invoices vi
set status = private.derived_payment_status(
  vi.amount,
  coalesce((select sum(vp.amount) from public.vendor_payments vp where vp.vendor_invoice_id = vi.id), 0)
)
where vi.status is distinct from 'void';

-- ---------------------------------------------------------------------------
-- BUG-007. Invoices cannot exceed the project value.
-- ---------------------------------------------------------------------------

create or replace function private.guard_client_invoice_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  project_value numeric;
  billed numeric;
begin
  if new.status = 'void' then
    return new;
  end if;

  select total_value
  into project_value
  from public.projects
  where id = new.project_id;

  select coalesce(sum(amount), 0)
  into billed
  from public.client_invoices
  where project_id = new.project_id
    and id is distinct from new.id
    and status is distinct from 'void';

  if coalesce(project_value, 0) < billed + new.amount then
    raise exception 'Invoices for this project cannot exceed the project value.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists client_invoices_project_cap on public.client_invoices;
create trigger client_invoices_project_cap
  before insert or update of amount, project_id, status on public.client_invoices
  for each row
  execute function private.guard_client_invoice_cap();

create or replace function private.guard_project_value_floor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  billed numeric;
begin
  select coalesce(sum(amount), 0)
  into billed
  from public.client_invoices
  where project_id = new.id
    and status is distinct from 'void';

  if new.total_value < billed then
    raise exception 'Project value cannot be less than invoices already issued.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists projects_value_floor on public.projects;
create trigger projects_value_floor
  before update of total_value on public.projects
  for each row
  execute function private.guard_project_value_floor();

-- ---------------------------------------------------------------------------
-- BUG-009 and BUG-012. Dates, positive values, and whole quantities.
-- ---------------------------------------------------------------------------

alter table public.leads drop constraint if exists leads_added_on_launch;
alter table public.leads
  add constraint leads_added_on_launch
  check (added_on >= date '2021-01-01');

alter table public.projects drop constraint if exists projects_started_on_launch;
alter table public.projects
  add constraint projects_started_on_launch
  check (started_on >= date '2021-01-01');

alter table public.budgets drop constraint if exists budgets_period_year_check;
alter table public.budgets
  add constraint budgets_period_year_check
  check (period_year >= 2021 and period_year <= 2100);

alter table public.projects drop constraint if exists projects_total_value_check;
alter table public.projects
  add constraint projects_total_value_check
  check (total_value > 0);

alter table public.vendor_purchase_orders drop constraint if exists vendor_purchase_orders_total_value_check;
alter table public.vendor_purchase_orders
  add constraint vendor_purchase_orders_total_value_check
  check (total_value > 0);

alter table public.assets drop constraint if exists assets_quantity_check;
alter table public.assets
  add constraint assets_quantity_check
  check (quantity >= 1 and quantity = trunc(quantity));

-- ---------------------------------------------------------------------------
-- BUG-010. Case-insensitive unique names.
-- ---------------------------------------------------------------------------

create unique index if not exists clients_display_name_ci
  on public.clients (
    lower(btrim(coalesce(nullif(btrim(person_name), ''), nullif(btrim(company_name), ''))))
  )
  where coalesce(nullif(btrim(person_name), ''), nullif(btrim(company_name), '')) is not null;

create unique index if not exists vendors_display_name_ci
  on public.vendors (
    lower(btrim(coalesce(nullif(btrim(person_name), ''), nullif(btrim(company_name), ''))))
  )
  where coalesce(nullif(btrim(person_name), ''), nullif(btrim(company_name), '')) is not null;

create unique index if not exists departments_name_ci
  on public.departments (lower(btrim(name)));
create unique index if not exists project_types_name_ci
  on public.project_types (lower(btrim(name)));
create unique index if not exists project_phases_name_ci
  on public.project_phases (lower(btrim(name)));
create unique index if not exists office_expense_categories_name_ci
  on public.office_expense_categories (lower(btrim(name)));
create unique index if not exists project_expense_categories_name_ci
  on public.project_expense_categories (lower(btrim(name)));
create unique index if not exists payment_methods_name_ci
  on public.payment_methods (lower(btrim(name)));

-- ---------------------------------------------------------------------------
-- BUG-011. Lead email and phone.
-- ---------------------------------------------------------------------------

alter table public.leads drop constraint if exists leads_email_format;
alter table public.leads
  add constraint leads_email_format
  check (
    email is null
    or btrim(email) = ''
    or email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  );

alter table public.leads drop constraint if exists leads_phone_digits;
alter table public.leads
  add constraint leads_phone_digits
  check (
    phone is null
    or btrim(phone) = ''
    or length(regexp_replace(phone, '[^0-9]', '', 'g')) >= 11
  );

-- ---------------------------------------------------------------------------
-- BUG-013. Vendor payment date is on or after the purchase order date.
-- ---------------------------------------------------------------------------

create or replace function private.guard_vendor_payment_date()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  po_date date;
begin
  select po.issued_on
  into po_date
  from public.vendor_invoices vi
  join public.vendor_purchase_orders po on po.id = vi.purchase_order_id
  where vi.id = new.vendor_invoice_id;

  if po_date is not null and new.paid_on < po_date then
    raise exception 'Payment date cannot be before the purchase order date.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists vendor_payments_date_guard on public.vendor_payments;
create trigger vendor_payments_date_guard
  before insert or update of paid_on, vendor_invoice_id on public.vendor_payments
  for each row
  execute function private.guard_vendor_payment_date();

-- ---------------------------------------------------------------------------
-- BUG-019. Stable message for a leave date before joining.
-- ---------------------------------------------------------------------------

alter table public.employees drop constraint if exists employees_leave_after_join;
alter table public.employees
  add constraint employees_leave_after_join
  check (leave_date is null or leave_date >= joining_date);

-- ---------------------------------------------------------------------------
-- BUG-020. Vendor invoice amounts require Vendor Payments.
-- Purchase-order totals remain on vendor_po_balances.
-- ---------------------------------------------------------------------------

drop policy if exists vendor_invoices_select on public.vendor_invoices;
create policy vendor_invoices_select on public.vendor_invoices
  for select to authenticated
  using (
    private.can('vendor_payments', 'view')
    or private.can('accounts_payable', 'view')
    or private.can('expense', 'view')
  );

create or replace view public.vendor_po_balances
with (security_invoker = false) as
select
  po.id as purchase_order_id,
  po.project_id,
  po.vendor_id,
  po.total_value,
  coalesce(sum(vp.amount), 0::numeric)::numeric(14, 2) as total_paid,
  greatest(po.total_value - coalesce(sum(vp.amount), 0::numeric), 0::numeric)::numeric(14, 2) as total_pending
from public.vendor_purchase_orders po
left join public.vendor_invoices vi on vi.purchase_order_id = po.id
left join public.vendor_payments vp on vp.vendor_invoice_id = vi.id
where private.can('purchase_orders', 'view')
   or private.can('vendor_payments', 'view')
   or private.can('accounts_payable', 'view')
   or private.can('expense', 'view')
   or private.can('dashboard', 'view')
group by po.id;

grant select on public.vendor_po_balances to authenticated;

-- ---------------------------------------------------------------------------
-- BUG-021. Asset category is a settings catalog.
-- ---------------------------------------------------------------------------

create table if not exists public.asset_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists asset_categories_name_ci
  on public.asset_categories (lower(btrim(name)));

alter table public.asset_categories enable row level security;

drop policy if exists asset_categories_select on public.asset_categories;
create policy asset_categories_select on public.asset_categories
  for select to authenticated using (private.is_active_member());

drop policy if exists asset_categories_insert on public.asset_categories;
create policy asset_categories_insert on public.asset_categories
  for insert to authenticated with check (private.is_owner());

drop policy if exists asset_categories_update on public.asset_categories;
create policy asset_categories_update on public.asset_categories
  for update to authenticated
  using (private.is_owner())
  with check (private.is_owner());

drop policy if exists asset_categories_delete on public.asset_categories;
create policy asset_categories_delete on public.asset_categories
  for delete to authenticated using (private.is_owner());

grant select, insert, update, delete on public.asset_categories to authenticated;

alter table public.assets
  add column if not exists category_id uuid;

insert into public.asset_categories (name, sort_order)
select distinct btrim(category), 0
from public.assets
where category is not null
  and btrim(category) <> ''
  and not exists (
    select 1
    from public.asset_categories existing
    where lower(btrim(existing.name)) = lower(btrim(assets.category))
  );

update public.assets a
set category_id = c.id
from public.asset_categories c
where a.category_id is null
  and a.category is not null
  and lower(btrim(a.category)) = lower(btrim(c.name));

alter table public.assets
  drop constraint if exists assets_category_id_fkey;

alter table public.assets
  add constraint assets_category_id_fkey
  foreign key (category_id)
  references public.asset_categories (id)
  on delete restrict;

create or replace view public.asset_register
with (security_invoker = true) as
select
  a.id as asset_id,
  a.purchase_date,
  a.name,
  c.name as category,
  a.quantity,
  a.unit_cost,
  a.total_cost,
  a.lifespan_years,
  (a.lifespan_years * 12::numeric)::numeric(10, 2) as lifespan_months,
  least(
    a.lifespan_years * 12::numeric,
    greatest(
      0::numeric,
      extract(year from age(current_date::timestamp with time zone, a.purchase_date::timestamp with time zone)) * 12::numeric
        + extract(month from age(current_date::timestamp with time zone, a.purchase_date::timestamp with time zone))
        + extract(day from age(current_date::timestamp with time zone, a.purchase_date::timestamp with time zone)) / 30.0
    )
  )::numeric(10, 2) as months_used,
  case
    when (a.lifespan_years * 12::numeric) = 0::numeric then 0::numeric
    else round(a.total_cost / (a.lifespan_years * 12::numeric), 2)
  end as monthly_depreciation,
  greatest(
    0::numeric,
    a.total_cost - least(
      a.lifespan_years * 12::numeric,
      greatest(
        0::numeric,
        extract(year from age(current_date::timestamp with time zone, a.purchase_date::timestamp with time zone)) * 12::numeric
          + extract(month from age(current_date::timestamp with time zone, a.purchase_date::timestamp with time zone))
          + extract(day from age(current_date::timestamp with time zone, a.purchase_date::timestamp with time zone)) / 30.0
      )
    ) * (a.total_cost / nullif(a.lifespan_years * 12::numeric, 0::numeric))
  )::numeric(14, 2) as current_value,
  a.notes,
  a.created_at
from public.assets a
left join public.asset_categories c on c.id = a.category_id;

alter table public.assets drop column if exists category;
