-- Every office expense category has a report group, and the dashboard
-- cash buckets match the Financial Report accrual buckets for one period.
-- Read-only. Run with psql as a role that can execute private functions,
-- after 20261023233000_office_expense_report_group.sql is applied.

do $$
declare
  v_missing integer;
  v_cash jsonb;
  v_accrual jsonb;
  v_dashboard jsonb;
  v_from date := date '0001-01-01';
  v_to date := date '9999-12-31';
  v_admin numeric;
  v_operational numeric;
  v_marketing numeric;
  v_salary numeric;
  v_payroll numeric;
begin
  select count(*)
  into v_missing
  from public.office_expense_categories
  where report_group is null
     or report_group not in ('admin', 'salary', 'marketing', 'operational');

  if v_missing <> 0 then
    raise exception 'office expense category missing report_group: %', v_missing;
  end if;

  if exists (
    select 1
    from public.office_expense_categories
    where lower(btrim(name)) = 'employee salary'
      and report_group is distinct from 'salary'
  ) or exists (
    select 1
    from public.office_expense_categories
    where lower(btrim(name)) in ('office rent', 'office materials', 'legal', 'internet bill')
      and report_group is distinct from 'admin'
  ) then
    raise exception 'named office expense category has the wrong report group';
  end if;

  v_cash := private.report_profit(v_from, v_to);
  v_accrual := private.report_profit_accrual(v_from, v_to);
  v_dashboard := private.dashboard_components(v_from, v_to);

  if (v_dashboard->>'admin') is distinct from (v_cash->>'admin')
    or (v_dashboard->>'operational') is distinct from (v_cash->>'operational')
    or (v_dashboard->>'marketing') is distinct from (v_cash->>'marketing')
    or (v_dashboard->>'salary') is distinct from (v_cash->>'salary')
  then
    raise exception 'dashboard buckets % differ from cash profit %', v_dashboard, v_cash;
  end if;

  if (v_cash->>'admin') is distinct from (v_accrual->>'admin')
    or (v_cash->>'operational') is distinct from (v_accrual->>'operational')
    or (v_cash->>'marketing') is distinct from (v_accrual->>'marketing')
    or (v_cash->>'salary') is distinct from (v_accrual->>'salary')
  then
    raise exception 'dashboard buckets % differ from the financial report %', v_cash, v_accrual;
  end if;

  select coalesce(sum(bt.amount), 0)
  into v_payroll
  from public.bank_transactions bt
  where bt.transaction_date between v_from and v_to
    and bt.source_kind = 'payroll'
    and bt.direction = 'outflow';

  select
    coalesce(sum(amount) filter (where bucket = 'admin'), 0),
    coalesce(sum(amount) filter (where bucket = 'operational'), 0),
    coalesce(sum(amount) filter (where bucket = 'marketing'), 0),
    coalesce(sum(amount) filter (where bucket = 'salary'), 0)
  into v_admin, v_operational, v_marketing, v_salary
  from (
    select
      private.report_cost_group(null, oe.category, dept.name) as bucket,
      oe.amount
    from public.operational_expenses oe
    left join public.departments dept on dept.id = oe.department_id
    where oe.project_id is null
      and oe.expense_date between v_from and v_to
    union all
    select
      coalesce(
        office.report_group,
        private.report_admin_bucket(
          case
            when btrim(coalesce(po.work_type, '')) <> '' then po.work_type
            else 'Operational'
          end
        )
      ) as bucket,
      vp.amount
    from public.vendor_payments vp
    left join public.vendor_invoices vi on vi.id = vp.vendor_invoice_id
    left join private.vendor_purchase_orders po on po.id = vi.purchase_order_id
    left join public.office_expense_categories office on office.id = po.office_expense_category_id
    where po.id is not null
      and po.project_id is null
      and vp.paid_on between v_from and v_to
  ) rows;

  v_salary := v_salary + v_payroll;

  if round(v_admin, 2) is distinct from (v_cash->>'admin')::numeric
    or round(v_operational, 2) is distinct from (v_cash->>'operational')::numeric
    or round(v_marketing, 2) is distinct from (v_cash->>'marketing')::numeric
    or round(v_salary, 2) is distinct from (v_cash->>'salary')::numeric
  then
    raise exception
      'resolved cash buckets admin %, operational %, marketing %, salary % differ from report_profit %',
      v_admin, v_operational, v_marketing, v_salary, v_cash;
  end if;
end;
$$;
