-- Actual on a seeded project equals its vendor bills plus project-tagged expenses.
-- Void bills, unbilled purchase orders, and expenses with no project are excluded.
-- Run with psql against a database that has the project budget migration applied.
-- The transaction rolls back, including when an assertion fails.

begin;

do $$
declare
  v_client uuid;
  v_project uuid;
  v_other_project uuid;
  v_vendor uuid;
  v_bank uuid;
  v_category uuid;
  v_materials_po uuid;
  v_open_po uuid;
  v_other_po uuid;
  v_blank_po uuid;
  v_actual numeric;
  v_committed numeric;
  v_materials_actual numeric;
  v_materials_committed numeric;
  v_uncategorised_actual numeric;
  v_expected_actual numeric;
  v_expected_committed numeric;
begin
  insert into public.clients (kind, company_name)
  values ('company', 'Budget Test Client')
  returning id into v_client;

  insert into public.projects (client_id, name, started_on, total_value)
  values (v_client, 'Budget Test Project', current_date, 0)
  returning id into v_project;

  insert into public.projects (client_id, name, started_on, total_value)
  values (v_client, 'Budget Test Other Project', current_date, 0)
  returning id into v_other_project;

  insert into public.vendors (kind, company_name)
  values ('company', 'Budget Test Vendor')
  returning id into v_vendor;

  insert into public.bank_accounts (name, opening_balance)
  values ('Budget Test Bank', 1000000)
  returning id into v_bank;

  insert into public.project_expense_categories (name, sort_order)
  values ('Budget Test Materials', 900)
  returning id into v_category;

  insert into public.vendor_purchase_orders (
    vendor_id, project_id, issued_on, total_value, work_type
  )
  values (v_vendor, v_project, current_date, 1000, 'Budget Test Materials')
  returning id into v_materials_po;

  insert into public.vendor_invoices (purchase_order_id, issued_on, amount, status)
  values
    (v_materials_po, current_date, 400, 'unpaid'),
    (v_materials_po, current_date, 1000, 'void');

  insert into public.vendor_purchase_orders (
    vendor_id, project_id, issued_on, total_value, work_type
  )
  values (v_vendor, v_project, current_date, 200, 'budget test materials')
  returning id into v_open_po;

  insert into public.vendor_purchase_orders (
    vendor_id, project_id, issued_on, total_value, work_type
  )
  values (v_vendor, v_project, current_date, 300, 'Site Labour')
  returning id into v_other_po;

  insert into public.vendor_invoices (purchase_order_id, issued_on, amount, status)
  values (v_other_po, current_date, 300, 'unpaid');

  insert into public.vendor_purchase_orders (
    vendor_id, project_id, issued_on, total_value, work_type
  )
  values (v_vendor, v_project, current_date, 80, '')
  returning id into v_blank_po;

  insert into public.vendor_invoices (purchase_order_id, issued_on, amount, status)
  values (v_blank_po, current_date, 80, 'paid');

  insert into public.vendor_purchase_orders (
    vendor_id, project_id, issued_on, total_value, work_type
  )
  values (v_vendor, v_other_project, current_date, 5000, 'Budget Test Materials');

  insert into public.vendor_invoices (purchase_order_id, issued_on, amount, status)
  select id, current_date, 5000, 'unpaid'
  from public.vendor_purchase_orders
  where project_id = v_other_project;

  insert into public.operational_expenses (
    bank_account_id, category, amount, expense_date, project_id
  )
  values
    (v_bank, 'Budget Test Materials', 50, current_date, v_project),
    (v_bank, 'Office Tea', 25, current_date, v_project),
    (v_bank, 'Budget Test Materials', 999, current_date, null);

  select coalesce(sum(actual_amount), 0), coalesce(sum(committed_amount), 0)
    into v_actual, v_committed
  from private.project_budget_actual_rows()
  where project_id = v_project;

  select
    coalesce((
      select sum(vi.amount)
      from public.vendor_invoices vi
      join public.vendor_purchase_orders po on po.id = vi.purchase_order_id
      where po.project_id = v_project
        and vi.status is distinct from 'void'
    ), 0)
    + coalesce((
      select sum(oe.amount)
      from public.operational_expenses oe
      where oe.project_id = v_project
    ), 0)
  into v_expected_actual;

  select coalesce(sum(greatest(po.total_value - coalesce(billed.amount, 0), 0)), 0)
    into v_expected_committed
  from public.vendor_purchase_orders po
  left join (
    select purchase_order_id, sum(amount) as amount
    from public.vendor_invoices
    where status is distinct from 'void'
    group by purchase_order_id
  ) billed on billed.purchase_order_id = po.id
  where po.project_id = v_project;

  if v_actual is distinct from v_expected_actual then
    raise exception
      'Actual % does not match bill plus expense sum % for the seeded project',
      v_actual, v_expected_actual;
  end if;

  if v_committed is distinct from v_expected_committed then
    raise exception
      'Committed % does not match open purchase order remainder %',
      v_committed, v_expected_committed;
  end if;

  select actual_amount, committed_amount
    into v_materials_actual, v_materials_committed
  from private.project_budget_actual_rows()
  where project_id = v_project
    and category_id = v_category;

  if v_materials_actual is distinct from 450.00
     or v_materials_committed is distinct from 800.00 then
    raise exception
      'Materials actual % committed %, expected 450 and 800',
      v_materials_actual, v_materials_committed;
  end if;

  select coalesce(sum(actual_amount), 0)
    into v_uncategorised_actual
  from private.project_budget_actual_rows()
  where project_id = v_project
    and category_id is null
    and category_name = 'Uncategorised';

  if v_uncategorised_actual is distinct from 405.00 then
    raise exception
      'Uncategorised actual %, expected 405',
      v_uncategorised_actual;
  end if;

  if exists (
    select 1
    from private.project_budget_actual_rows()
    where project_id = v_project
      and actual_amount = 999
  ) then
    raise exception 'An expense with no project was included in Actual';
  end if;
end $$;

rollback;
