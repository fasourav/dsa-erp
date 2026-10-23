-- Office expense categories choose their report group.
-- The group is admin, salary, marketing, or operational.
-- Reports use that group. The old keyword guess stays as a fallback.
-- This file is not applied by the app. Apply it with the normal migration flow.
--
-- No view selects this table. The activity trigger logs to_jsonb(new),
-- so the new column is included without rewriting the trigger.
-- project_budget_actual_rows groups project spend by project expense
-- category. It does not use this bucket, so it stays as it is.
-- financial_report reads the bucket keys from report_profit_accrual,
-- so replacing that function updates the report.

alter table public.office_expense_categories
  add column report_group text;

alter table public.office_expense_categories
  add constraint office_expense_categories_report_group_check
  check (report_group in ('admin', 'salary', 'marketing', 'operational'));

comment on column public.office_expense_categories.report_group is
  'Dashboard and financial-report bucket: admin, salary, marketing, or operational.';

-- Named rows get the group the business chose. Any other existing row
-- keeps the keyword result from private.report_admin_bucket.
update public.office_expense_categories
set report_group = case lower(btrim(name))
  when 'employee salary' then 'salary'
  when 'office rent' then 'admin'
  when 'office materials' then 'admin'
  when 'legal' then 'admin'
  when 'internet bill' then 'admin'
  else private.report_admin_bucket(name)
end
where report_group is null;

alter table public.office_expense_categories
  alter column report_group set default 'operational',
  alter column report_group set not null;

-- Category id, else category name, else the department name through the
-- keyword rule, else the keyword rule on the category name.
-- report_admin_bucket stays. Callers that still use it keep working.
create or replace function private.report_cost_group(
  p_category_id uuid,
  p_category_name text,
  p_department_name text default null
)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    (
      select category.report_group
      from public.office_expense_categories as category
      where p_category_id is not null
        and category.id = p_category_id
      limit 1
    ),
    (
      select category.report_group
      from public.office_expense_categories as category
      where p_category_id is null
        and btrim(coalesce(p_category_name, '')) <> ''
        and lower(btrim(category.name)) = lower(btrim(p_category_name))
      limit 1
    ),
    case
      when btrim(coalesce(p_department_name, '')) <> ''
        and not exists (
          select 1
          from public.office_expense_categories as category
          where (p_category_id is not null and category.id = p_category_id)
            or (
              p_category_id is null
              and btrim(coalesce(p_category_name, '')) <> ''
              and lower(btrim(category.name)) = lower(btrim(p_category_name))
            )
        )
      then private.report_admin_bucket(p_department_name)
      else null
    end,
    private.report_admin_bucket(p_category_name)
  );
$$;

comment on function private.report_cost_group(uuid, text, text) is
  'Office cost group. Category report_group by id, else by name, else the department name through report_admin_bucket, else report_admin_bucket on the category name.';

revoke all on function private.report_cost_group(uuid, text, text) from public, anon, authenticated;

-- Cash profit. An operational purchase order uses its office category
-- report_group, then the work type, then Operational.
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
      end as work_type,
      case
        when po.id is not null and po.project_id is null then
          coalesce(
            office.report_group,
            private.report_admin_bucket(
              case
                when btrim(coalesce(po.work_type, '')) <> '' then po.work_type
                else 'Operational'
              end
            )
          )
        else null
      end as office_bucket
    from public.vendor_payments vp
    left join public.vendor_invoices vi on vi.id = vp.vendor_invoice_id
    left join private.vendor_purchase_orders po on po.id = vi.purchase_order_id
    left join public.project_expense_categories cat on cat.id = po.expense_category_id
    left join public.office_expense_categories office on office.id = po.office_expense_category_id
    where vp.paid_on between p_from and p_to
  ),
  operational as (
    select
      oe.amount,
      oe.project_id,
      private.report_cost_group(null, oe.category, dept.name) as bucket
    from public.operational_expenses oe
    left join public.departments dept on dept.id = oe.department_id
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
      coalesce((
        select sum(v.amount)
        from vendor v
        where not v.project_linked
          and coalesce(v.office_bucket, 'operational') = 'operational'
      ), 0)
      + coalesce((
        select sum(o.amount)
        from operational o
        where o.project_id is null
          and o.bucket = 'operational'
      ), 0)
    ),
    'marketing', private.report_money(
      coalesce((
        select sum(v.amount)
        from vendor v
        where not v.project_linked
          and v.office_bucket = 'marketing'
      ), 0)
      + coalesce((
        select sum(o.amount)
        from operational o
        where o.project_id is null
          and o.bucket = 'marketing'
      ), 0)
    ),
    'salary', private.report_money(
      coalesce((
        select sum(v.amount)
        from vendor v
        where not v.project_linked
          and v.office_bucket = 'salary'
      ), 0)
      + coalesce((
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
    'admin', private.report_money(
      coalesce((
        select sum(v.amount)
        from vendor v
        where not v.project_linked
          and v.office_bucket = 'admin'
      ), 0)
      + coalesce((
        select sum(o.amount)
        from operational o
        where o.project_id is null
          and o.bucket = 'admin'
      ), 0)
    ),
    'tax', private.report_money((
      select sum(vt.amount)
      from public.vat_tax_payments vt
      where vt.paid_on between p_from and p_to
    ))
  );
$$;

-- Accrual profit. Bills on an operational purchase order use the office
-- category report_group, then the work type, then Operational.
create or replace function private.report_profit_accrual(p_from date, p_to date)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with vendor as (
    select
      vi.amount,
      po.project_id is not null as project_linked,
      case
        when btrim(coalesce(cat.name, '')) <> '' then cat.name
        else po.work_type
      end as work_type,
      case
        when po.project_id is null then
          coalesce(
            office.report_group,
            private.report_admin_bucket(
              case
                when btrim(coalesce(po.work_type, '')) <> '' then po.work_type
                else 'Operational'
              end
            )
          )
        else null
      end as office_bucket
    from public.vendor_invoices vi
    join private.vendor_purchase_orders po on po.id = vi.purchase_order_id
    left join public.project_expense_categories cat on cat.id = po.expense_category_id
    left join public.office_expense_categories office on office.id = po.office_expense_category_id
    where vi.status is distinct from 'void'
      and coalesce(vi.issued_on, vi.created_at::date) between p_from and p_to
  ),
  operational as (
    select
      oe.amount,
      oe.project_id,
      private.report_cost_group(null, oe.category, dept.name) as bucket
    from public.operational_expenses oe
    left join public.departments dept on dept.id = oe.department_id
    where oe.expense_date between p_from and p_to
  )
  select jsonb_build_object(
    'revenue', private.report_money((
      select sum(ci.amount)
      from public.client_invoices ci
      where ci.status is distinct from 'void'
        and coalesce(ci.issued_on, ci.created_at::date) between p_from and p_to
    )),
    'material', private.report_money((
      select sum(v.amount) from vendor v
      where v.project_linked and private.report_is_material(v.work_type)
    )),
    'subcontractor', private.report_money((
      select sum(v.amount) from vendor v
      where v.project_linked and not private.report_is_material(v.work_type)
    )),
    'project_overhead', private.report_money((
      select sum(o.amount) from operational o where o.project_id is not null
    )),
    'operational', private.report_money(
      coalesce((
        select sum(v.amount) from vendor v
        where not v.project_linked
          and coalesce(v.office_bucket, 'operational') = 'operational'
      ), 0)
      + coalesce((
        select sum(o.amount) from operational o
        where o.project_id is null and o.bucket not in ('marketing', 'salary', 'admin')
      ), 0)
    ),
    'marketing', private.report_money(
      coalesce((
        select sum(v.amount) from vendor v
        where not v.project_linked and v.office_bucket = 'marketing'
      ), 0)
      + coalesce((
        select sum(o.amount) from operational o
        where o.project_id is null and o.bucket = 'marketing'
      ), 0)
    ),
    'salary', private.report_money(
      coalesce((
        select sum(v.amount) from vendor v
        where not v.project_linked and v.office_bucket = 'salary'
      ), 0)
      + coalesce((
        select sum(o.amount) from operational o
        where o.project_id is null and o.bucket = 'salary'
      ), 0)
      + coalesce((
        select sum(bt.amount)
        from public.bank_transactions bt
        where bt.transaction_date between p_from and p_to
          and bt.source_kind = 'payroll'
          and bt.direction = 'outflow'
      ), 0)
    ),
    'admin', private.report_money(
      coalesce((
        select sum(v.amount) from vendor v
        where not v.project_linked and v.office_bucket = 'admin'
      ), 0)
      + coalesce((
        select sum(o.amount) from operational o
        where o.project_id is null and o.bucket = 'admin'
      ), 0)
    ),
    'tax', private.report_money((
      select sum(vt.amount)
      from public.vat_tax_payments vt
      where vt.paid_on between p_from and p_to
    )),
    'depreciation', private.report_money(
      private.report_accumulated_depreciation(p_to)
      - case
          when p_from <= date '0001-01-02' then 0
          else private.report_accumulated_depreciation(p_from - 1)
        end
    )
  );
$$;

revoke all on function private.report_profit_accrual(date, date) from public, anon, authenticated;

notify pgrst, 'reload schema';
