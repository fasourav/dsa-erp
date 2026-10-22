-- Project expense category on purchase orders.
-- There is no public.purchase_orders table. Purchase orders are
-- private.vendor_purchase_orders, exposed as the security-invoker view
-- public.vendor_purchase_orders. The column is nullable so existing rows
-- stay valid. New project purchase orders are required in the app.
-- This file is not applied by the app. Apply it with the normal migration flow.

alter table private.vendor_purchase_orders
  add column expense_category_id uuid
  references public.project_expense_categories (id) on delete restrict;

comment on column private.vendor_purchase_orders.expense_category_id is
  'Project expense category. Null on operational purchase orders and on project purchase orders saved before a category was chosen.';

create index vendor_purchase_orders_expense_category_id_idx
  on private.vendor_purchase_orders (expense_category_id);

create or replace view public.vendor_purchase_orders
with (security_invoker = true) as
select
  id,
  project_id,
  vendor_id,
  issued_on,
  work_type,
  (case when private.session_sees_money() then total_value end)::numeric(14, 2) as total_value,
  notes,
  created_at,
  updated_at,
  expense_category_id
from private.vendor_purchase_orders;

comment on view public.vendor_purchase_orders is
  'Purchase orders. total_value is null unless the caller can see money. Writes update private.vendor_purchase_orders.';

create or replace function private.vendor_purchase_orders_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  stored private.vendor_purchase_orders;
begin
  if tg_op = 'INSERT' then
    insert into private.vendor_purchase_orders (
      id, project_id, vendor_id, issued_on, work_type, total_value, notes,
      created_at, updated_at, expense_category_id
    ) values (
      coalesce(new.id, pg_catalog.gen_random_uuid()),
      new.project_id,
      new.vendor_id,
      coalesce(new.issued_on, current_date),
      new.work_type,
      coalesce(new.total_value, 0),
      new.notes,
      coalesce(new.created_at, pg_catalog.now()),
      coalesce(new.updated_at, pg_catalog.now()),
      new.expense_category_id
    )
    returning * into stored;
  elsif tg_op = 'UPDATE' then
    update private.vendor_purchase_orders as row
    set
      project_id = new.project_id,
      vendor_id = new.vendor_id,
      issued_on = new.issued_on,
      work_type = new.work_type,
      total_value = case
        when private.session_sees_money() then new.total_value
        when new.total_value is null then row.total_value
        else new.total_value
      end,
      notes = new.notes,
      updated_at = new.updated_at,
      expense_category_id = new.expense_category_id
    where row.id = old.id
    returning * into stored;
    if not found then
      return null;
    end if;
  else
    delete from private.vendor_purchase_orders as row
    where row.id = old.id
    returning * into stored;
    if not found then
      return null;
    end if;
  end if;

  if not private.session_sees_money() then
    stored.total_value := null;
  end if;
  return stored;
end;
$$;

-- Actual and committed amounts are unchanged. A purchase order with
-- expense_category_id uses that category. Otherwise the category is still
-- the project expense category whose name matches the work type.
create or replace function private.project_budget_actual_rows()
returns table (
  project_id uuid,
  category_id uuid,
  category_name text,
  actual_amount numeric,
  committed_amount numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with bill_lines as (
    select
      po.project_id,
      cat.id as category_id,
      coalesce(cat.name, 'Uncategorised') as category_name,
      vi.amount as actual_amount,
      0::numeric as committed_amount
    from public.vendor_invoices vi
    join private.vendor_purchase_orders po on po.id = vi.purchase_order_id
    left join public.project_expense_categories cat
      on cat.id = po.expense_category_id
      or (
        po.expense_category_id is null
        and btrim(coalesce(po.work_type, '')) <> ''
        and lower(btrim(cat.name)) = lower(btrim(po.work_type))
      )
    where po.project_id is not null
      and vi.status is distinct from 'void'
  ),
  expense_lines as (
    select
      oe.project_id,
      cat.id as category_id,
      coalesce(cat.name, 'Uncategorised') as category_name,
      oe.amount as actual_amount,
      0::numeric as committed_amount
    from public.operational_expenses oe
    left join public.project_expense_categories cat
      on btrim(coalesce(oe.category, '')) <> ''
     and lower(btrim(cat.name)) = lower(btrim(oe.category))
    where oe.project_id is not null
  ),
  committed_lines as (
    select
      po.project_id,
      cat.id as category_id,
      coalesce(cat.name, 'Uncategorised') as category_name,
      0::numeric as actual_amount,
      greatest(po.total_value - coalesce(billed.amount, 0), 0) as committed_amount
    from private.vendor_purchase_orders po
    left join public.project_expense_categories cat
      on cat.id = po.expense_category_id
      or (
        po.expense_category_id is null
        and btrim(coalesce(po.work_type, '')) <> ''
        and lower(btrim(cat.name)) = lower(btrim(po.work_type))
      )
    left join (
      select purchase_order_id, coalesce(sum(amount), 0) as amount
      from public.vendor_invoices
      where status is distinct from 'void'
      group by purchase_order_id
    ) billed on billed.purchase_order_id = po.id
    where po.project_id is not null
      and greatest(po.total_value - coalesce(billed.amount, 0), 0) > 0
  ),
  combined as (
    select * from bill_lines
    union all
    select * from expense_lines
    union all
    select * from committed_lines
  )
  select
    combined.project_id,
    combined.category_id,
    combined.category_name,
    coalesce(sum(combined.actual_amount), 0)::numeric(14, 2) as actual_amount,
    coalesce(sum(combined.committed_amount), 0)::numeric(14, 2) as committed_amount
  from combined
  group by combined.project_id, combined.category_id, combined.category_name
  having coalesce(sum(combined.actual_amount), 0) <> 0
      or coalesce(sum(combined.committed_amount), 0) <> 0;
$$;

create or replace view public.project_budget_actual
with (security_invoker = true) as
select
  project_id,
  project_name,
  category_id,
  category_name,
  actual_amount::numeric(14, 2) as actual_amount,
  committed_amount::numeric(14, 2) as committed_amount
from private.project_budget_actual_visible();

comment on view public.project_budget_actual is
  'Actual and committed spend by project and category. Actual sums vendor bills and project-tagged operational expenses. Anyone who can view projects or project budgets can read it. The view is security invoker; the row query stays in private.project_budget_actual_visible().';

-- Dashboard Expense Summary reads private.report_profit through
-- private.dashboard_components. Amounts and the other buckets stay the same.
-- A project payment whose purchase order has a category uses that category
-- name for Material vs Subcontractor. With no category, the work type decides,
-- as before. Cash financial reports call this same function, so that split
-- moves with the dashboard. Bill-dated accrual reports are unchanged.
create or replace function private.report_profit(p_from date, p_to date)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with vendor as (
    select
      vp.amount,
      case
        when po.id is null then true
        else po.project_id is not null
      end as project_linked,
      case
        when btrim(coalesce(cat.name, '')) <> '' then cat.name
        else po.work_type
      end as work_type
    from public.vendor_payments vp
    left join public.vendor_invoices vi on vi.id = vp.vendor_invoice_id
    left join private.vendor_purchase_orders po on po.id = vi.purchase_order_id
    left join public.project_expense_categories cat on cat.id = po.expense_category_id
    where vp.paid_on between p_from and p_to
  ),
  operational as (
    select
      oe.amount,
      oe.project_id,
      private.report_admin_bucket(oe.category) as bucket
    from public.operational_expenses oe
    where oe.expense_date between p_from and p_to
  )
  select jsonb_build_object(
    'revenue', private.report_money((
      select sum(cp.amount)
      from public.client_payments cp
      where cp.paid_on between p_from and p_to
    )),
    'material', private.report_money((
      select sum(v.amount)
      from vendor v
      where v.project_linked
        and private.report_is_material(v.work_type)
    )),
    'subcontractor', private.report_money((
      select sum(v.amount)
      from vendor v
      where v.project_linked
        and not private.report_is_material(v.work_type)
    )),
    'project_overhead', private.report_money((
      select sum(o.amount)
      from operational o
      where o.project_id is not null
    )),
    'operational', private.report_money(
      coalesce((select sum(v.amount) from vendor v where not v.project_linked), 0)
      + coalesce((
        select sum(o.amount)
        from operational o
        where o.project_id is null
          and o.bucket = 'operational'
      ), 0)
    ),
    'marketing', private.report_money((
      select sum(o.amount)
      from operational o
      where o.project_id is null
        and o.bucket = 'marketing'
    )),
    'salary', private.report_money(
      coalesce((
        select sum(o.amount)
        from operational o
        where o.project_id is null
          and o.bucket = 'salary'
      ), 0)
      + coalesce((
        select sum(bt.amount)
        from public.bank_transactions bt
        where bt.transaction_date between p_from and p_to
          and bt.source_kind = 'payroll'
          and bt.direction = 'outflow'
      ), 0)
    ),
    'admin', private.report_money((
      select sum(o.amount)
      from operational o
      where o.project_id is null
        and o.bucket = 'admin'
    )),
    'tax', private.report_money((
      select sum(vt.amount)
      from public.vat_tax_payments vt
      where vt.paid_on between p_from and p_to
    ))
  );
$$;

notify pgrst, 'reload schema';
