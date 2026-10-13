-- Round 2 QA. Safe to re-run. Does not change grants on the readable views.
-- dashboard_feed is new: authenticated may execute it; anon and public may not.
-- service_role keeps the default execute grant from function creation.

-- Advisor: private.derived_payment_status had a mutable search_path.
alter function private.derived_payment_status(numeric, numeric)
  set search_path = public;

-- NEW-05. Bank account names are unique ignoring case and surrounding spaces.
do $$
begin
  if exists (
    select 1
    from public.bank_accounts
    group by lower(btrim(name))
    having count(*) > 1
  ) then
    raise exception 'bank account names are not unique; resolve duplicates before adding bank_accounts_name_ci';
  end if;
end $$;

create unique index if not exists bank_accounts_name_ci
  on public.bank_accounts (lower(btrim(name)));

-- Vendor invoices cannot be deleted while payments exist.
-- Same restrict behavior as client_payments -> client_invoices.
alter table public.vendor_payments
  drop constraint if exists vendor_payments_vendor_invoice_id_fkey;

alter table public.vendor_payments
  add constraint vendor_payments_vendor_invoice_id_fkey
  foreign key (vendor_invoice_id)
  references public.vendor_invoices (id)
  on delete restrict;

-- NEW-01. A negative balance names the account, the available balance,
-- and the amount this transaction needs. Hint is "available,needed".
create or replace function private.assert_account_balance(account uuid)
returns void
language plpgsql
security definer
set search_path = public
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
      hint = trim(to_char(available, 'FM999999999990.00'))
        || ','
        || trim(to_char(needed, 'FM999999999990.00'));
end;
$$;

-- NEW-07. One security-definer read for the dashboard.
-- The gate matches hasFullDashboardAccess: Show Financials plus view on
-- every dashboard source module. Callers who fail the gate get null.
-- Amounts are aggregated in SQL. Indexes below cover the date scans.
create index if not exists client_payments_paid_on_idx
  on public.client_payments (paid_on);

create index if not exists vendor_payments_paid_on_idx
  on public.vendor_payments (paid_on);

create index if not exists vat_tax_payments_paid_on_idx
  on public.vat_tax_payments (paid_on);

create index if not exists client_invoices_status_idx
  on public.client_invoices (status);

create or replace function public.dashboard_feed()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if auth.uid() is null
    or not private.sees_financials()
    or not private.can('dashboard', 'view')
    or not private.can('projects', 'view')
    or not private.can('leads', 'view')
    or not private.can('clients', 'view')
    or not private.can('vendor_payments', 'view')
    or not private.can('purchase_orders', 'view')
    or not private.can('expenses', 'view')
    or not private.can('vat_tax', 'view')
    or not private.can('banking', 'view')
    or not private.can('client_invoices', 'view')
    or not private.can('accounts_receivable', 'view')
    or not private.can('accounts_payable', 'view')
    or not private.can('income', 'view')
    or not private.can('backlog', 'view')
  then
    return null;
  end if;

  select jsonb_build_object(
    'projects', coalesce((
      select jsonb_agg(jsonb_build_object(
        'total_value', p.total_value,
        'status', p.status,
        'started_on', p.started_on,
        'year', p.year
      ))
      from public.projects p
    ), '[]'::jsonb),
    'client_count', (select count(*) from public.clients),
    'leads', coalesce((
      select jsonb_agg(jsonb_build_object(
        'status', l.status,
        'estimated_value', l.estimated_value,
        'is_open', coalesce(s.is_open, false)
      ))
      from public.leads l
      left join public.lead_statuses s on s.code = l.status
    ), '[]'::jsonb),
    'revenue', coalesce((
      select jsonb_agg(jsonb_build_object('date', day, 'amount', total))
      from (
        select paid_on as day, sum(amount) as total
        from public.client_payments
        where paid_on is not null
        group by paid_on
      ) days
    ), '[]'::jsonb),
    'vendor_payments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', day,
        'amount', total,
        'work_type', work_type,
        'project_linked', project_linked
      ))
      from (
        select
          vp.paid_on as day,
          sum(vp.amount) as total,
          po.work_type,
          case
            when po.id is null then true
            else po.project_id is not null
          end as project_linked
        from public.vendor_payments vp
        left join public.vendor_invoices vi on vi.id = vp.vendor_invoice_id
        left join public.vendor_purchase_orders po on po.id = vi.purchase_order_id
        where vp.paid_on is not null
        group by vp.paid_on, po.work_type, po.id, po.project_id
      ) days
    ), '[]'::jsonb),
    'operational', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', day,
        'amount', total,
        'category', category,
        'project_linked', project_linked
      ))
      from (
        select
          expense_date as day,
          coalesce(category, '') as category,
          project_id is not null as project_linked,
          sum(amount) as total
        from public.operational_expenses
        where expense_date is not null
        group by expense_date, coalesce(category, ''), project_id is not null
      ) days
    ), '[]'::jsonb),
    'taxes', coalesce((
      select jsonb_agg(jsonb_build_object('date', day, 'amount', total))
      from (
        select paid_on as day, sum(amount) as total
        from public.vat_tax_payments
        where paid_on is not null
        group by paid_on
      ) days
    ), '[]'::jsonb),
    'bank', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', day,
        'amount', total,
        'direction', direction,
        'source_kind', source_kind
      ))
      from (
        select
          transaction_date as day,
          direction,
          source_kind,
          sum(amount) as total
        from public.bank_transactions
        where transaction_date is not null
          and source_kind is not null
          and direction in ('inflow', 'outflow')
        group by transaction_date, direction, source_kind
      ) days
    ), '[]'::jsonb),
    'opening_balance', coalesce((
      select sum(opening_balance) from public.bank_accounts
    ), 0),
    'billed', coalesce((
      select sum(ci.amount)
      from public.client_invoices ci
      join public.projects p on p.id = ci.project_id
      join public.clients c on c.id = ci.client_id
      where ci.status is distinct from 'void'
    ), 0),
    'ledger_paid', coalesce((
      select sum(cp.amount)
      from public.client_payments cp
      join public.client_invoices ci on ci.id = cp.client_invoice_id
      join public.projects p on p.id = ci.project_id
      join public.clients c on c.id = ci.client_id
      where ci.status is distinct from 'void'
    ), 0),
    'receivables', coalesce((
      select sum(greatest(ci.amount - coalesce(paid.total_paid, 0), 0))
      from public.client_invoices ci
      join public.projects p on p.id = ci.project_id
      join public.clients c on c.id = ci.client_id
      left join lateral (
        select coalesce(sum(cp.amount), 0) as total_paid
        from public.client_payments cp
        where cp.client_invoice_id = ci.id
      ) paid on true
      where ci.status is distinct from 'void'
    ), 0),
    'payables', coalesce((
      select sum(greatest(po.total_value - coalesce(paid.total_paid, 0), 0))
      from public.vendor_purchase_orders po
      join public.projects p on p.id = po.project_id
      join public.vendors v on v.id = po.vendor_id
      left join lateral (
        select coalesce(sum(vp.amount), 0) as total_paid
        from public.vendor_invoices vi
        join public.vendor_payments vp on vp.vendor_invoice_id = vi.id
        where vi.purchase_order_id = po.id
      ) paid on true
    ), 0),
    'backlog_count', (select count(*) from public.project_backlogs),
    'launch_date', (
      select launch_date from public.company_settings where id is true
    )
  )
  into result;

  return result;
end;
$$;

revoke all on function public.dashboard_feed() from public, anon;
grant execute on function public.dashboard_feed() to authenticated;
