-- QA 2026-10-16 fixes. Not applied to live by this change; apply with the usual migration flow.

-- L11: duplicate index (same definition as activity_log_created_at_idx).
drop index if exists public.activity_log_created_at_desc_idx;

-- H2/H3: one rule for money visibility, used by every money view.
create or replace function private.sees_money()
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select private.is_owner() or private.sees_financials();
$$;
revoke all on function private.sees_money() from public, anon;
grant execute on function private.sees_money() to authenticated;

-- H4/M1: no future dates on money movements and on records that describe the past.
create or replace function private.guard_date_not_future()
returns trigger
language plpgsql
set search_path to ''
as $$
declare
  next_day date := (to_jsonb(new) ->> tg_argv[0])::date;
begin
  if tg_op = 'UPDATE' and next_day is not distinct from (to_jsonb(old) ->> tg_argv[0])::date then
    return new;
  end if;
  if next_day > (timezone('Asia/Dhaka', now()))::date then
    raise exception '% can''t be in the future.', tg_argv[1] using errcode = '23514';
  end if;
  return new;
end;
$$;

do $$
declare
  item record;
begin
  for item in
    select * from (values
      ('operational_expenses', 'expense_date', 'Expense date'),
      ('bank_transactions', 'transaction_date', 'Transaction date'),
      ('bank_transfers', 'transfer_date', 'Transfer date'),
      ('payroll_runs', 'paid_on', 'Payment date'),
      ('leads', 'added_on', 'Added date'),
      ('projects', 'started_on', 'Start date'),
      ('client_invoices', 'issued_on', 'Issue date'),
      ('vendor_invoices', 'issued_on', 'Bill date'),
      ('vendor_purchase_orders', 'issued_on', 'Purchase order date'),
      ('assets', 'purchase_date', 'Purchase date'),
      ('employees', 'joining_date', 'Joining date')
    ) as t(tbl, col, label)
  loop
    execute format('drop trigger if exists %I on public.%I', item.tbl || '_date_not_future', item.tbl);
    execute format(
      'create trigger %I before insert or update of %I on public.%I for each row execute function private.guard_date_not_future(%L, %L)',
      item.tbl || '_date_not_future', item.col, item.tbl, item.col, item.label
    );
  end loop;
end;
$$;

-- M2: a client payment can't predate its invoice; a vendor payment can't predate its bill.
create or replace function private.guard_client_payment_date()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  invoice_day date;
begin
  select ci.issued_on into invoice_day
  from public.client_invoices ci
  where ci.id = new.client_invoice_id;
  if invoice_day is not null and new.paid_on < invoice_day then
    raise exception 'Payment date cannot be before the invoice date.' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists client_payments_date_guard on public.client_payments;
create trigger client_payments_date_guard
  before insert or update of paid_on, client_invoice_id on public.client_payments
  for each row execute function private.guard_client_payment_date();

create or replace function private.guard_vendor_payment_date()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  po_date date;
  bill_date date;
begin
  select po.issued_on, vi.issued_on
  into po_date, bill_date
  from public.vendor_invoices vi
  join public.vendor_purchase_orders po on po.id = vi.purchase_order_id
  where vi.id = new.vendor_invoice_id;

  if po_date is not null and new.paid_on < po_date then
    raise exception 'Payment date cannot be before the purchase order date.'
      using errcode = '23514';
  end if;
  if bill_date is not null and new.paid_on < bill_date then
    raise exception 'Payment date cannot be before the bill date.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

-- M3: VAT/tax can't be paid before the project started or before the books start.
create or replace function private.guard_vat_payment_date()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  start_day date;
  launch_day date;
begin
  select p.started_on into start_day from public.projects p where p.id = new.project_id;
  select s.launch_date into launch_day from public.company_settings s where s.id is true;
  if start_day is not null and new.paid_on < start_day then
    raise exception 'Payment date cannot be before the project start date.' using errcode = '23514';
  end if;
  if launch_day is not null and new.paid_on < launch_day then
    raise exception 'Payment date cannot be before the launch date.' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists vat_tax_payments_date_guard on public.vat_tax_payments;
create trigger vat_tax_payments_date_guard
  before insert or update of paid_on, project_id on public.vat_tax_payments
  for each row execute function private.guard_vat_payment_date();

-- M3: the balance guard checks every day's closing balance, not only today's,
-- so a back-dated outflow can't overdraw the account on an earlier day.
create or replace function private.assert_account_balance(account uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  opening numeric;
  account_name text;
  lowest numeric;
  lowest_before numeric;
  available numeric;
  needed numeric;
begin
  if account is null then
    return;
  end if;

  select a.opening_balance, a.name into opening, account_name
  from public.bank_accounts a
  where a.id = account;
  if not found then
    return;
  end if;

  select
    least(opening, min(day_balance)),
    least(opening, min(day_balance_before))
  into lowest, lowest_before
  from (
    select
      opening + sum(signed) over (order by transaction_date) as day_balance,
      opening + sum(case when mine then 0 else signed end) over (order by transaction_date) as day_balance_before
    from (
      select
        t.transaction_date,
        case when t.direction = 'inflow' then t.amount else -t.amount end as signed,
        t.xmin = pg_current_xact_id()::xid as mine
      from public.bank_transactions t
      where t.bank_account_id = account
    ) tx
  ) days;

  if coalesce(lowest, 0) >= 0 then
    return;
  end if;

  available := greatest(coalesce(lowest_before, 0), 0);
  needed := available - lowest;

  raise exception 'INSUFFICIENT_BALANCE'
    using
      errcode = '23514',
      detail = coalesce(nullif(btrim(account_name), ''), 'this account'),
      hint = case
        when private.sees_money() then
          trim(to_char(available, 'FM999999999990.00'))
            || ','
            || trim(to_char(needed, 'FM999999999990.00'))
        else ''
      end;
end;
$$;

-- M4: a quotation can't expire before it is issued.
alter table public.quotations
  drop constraint if exists quotations_valid_after_issue;
alter table public.quotations
  add constraint quotations_valid_after_issue
  check (valid_until is null or issued_on is null or valid_until >= issued_on) not valid;
alter table public.quotations validate constraint quotations_valid_after_issue;

-- L3: one purchase order can't be worth more than its project.
create or replace function private.guard_purchase_order_project_cap()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  project_value numeric;
begin
  if new.project_id is null then
    return new;
  end if;
  select p.total_value into project_value from public.projects p where p.id = new.project_id;
  if project_value is not null and new.total_value > project_value then
    raise exception 'Purchase order value cannot be more than the project value.' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists vendor_purchase_orders_project_cap on public.vendor_purchase_orders;
create trigger vendor_purchase_orders_project_cap
  before insert or update of total_value, project_id on public.vendor_purchase_orders
  for each row execute function private.guard_purchase_order_project_cap();

-- M7: optimistic concurrency. A writer that sends updated_at must send the
-- value it loaded; a mismatch means someone else saved first. Every update
-- stamps a fresh updated_at.
create or replace function private.guard_record_version()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  if new.updated_at is distinct from old.updated_at then
    raise exception 'This record was changed by someone else — reload.' using errcode = '40001';
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'leads', 'clients', 'vendors', 'projects', 'vendor_purchase_orders', 'client_invoices',
    'vendor_invoices', 'operational_expenses', 'employees', 'assets', 'quotations',
    'work_orders', 'issued_documents'
  ]
  loop
    execute format('drop trigger if exists %I on public.%I', tbl || '_version', tbl);
    execute format(
      'create trigger %I before update on public.%I for each row execute function private.guard_record_version()',
      tbl || '_version', tbl
    );
  end loop;
end;
$$;

-- H1: save a quotation or work order with its lines and payment schedule in
-- one transaction. Runs as the caller, so RLS and the table checks apply.
create or replace function public.save_business_document(
  p_kind text,
  p_id uuid,
  p_version timestamptz,
  p_fields jsonb,
  p_lines jsonb,
  p_milestones jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path to ''
as $$
declare
  head_table text;
  line_table text;
  milestone_table text;
  fk text;
  doc_id uuid := p_id;
  doc_no text;
  token text;
  ver timestamptz;
begin
  if p_kind = 'quotation' then
    head_table := 'quotations'; line_table := 'quotation_lines';
    milestone_table := 'quotation_milestones'; fk := 'quotation_id';
  elsif p_kind = 'work_order' then
    head_table := 'work_orders'; line_table := 'work_order_lines';
    milestone_table := 'work_order_milestones'; fk := 'work_order_id';
  else
    raise exception 'Unknown document kind.' using errcode = '22023';
  end if;

  if doc_id is not null then
    execute format(
      'update public.%I as d set (%s) = (select %s from jsonb_populate_record(null::public.%I, $1) r), updated_at = coalesce($3, d.updated_at) where d.id = $2 returning d.document_no, d.verify_token, d.updated_at',
      head_table,
      (select string_agg(format('%I', key), ', ') from jsonb_object_keys(p_fields) key),
      (select string_agg(format('r.%I', key), ', ') from jsonb_object_keys(p_fields) key),
      head_table
    ) using p_fields, doc_id, p_version into doc_no, token, ver;
    if doc_no is null then
      raise exception 'That document could not be found.' using errcode = 'P0002';
    end if;
  else
    execute format(
      'insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1) r returning id, document_no, verify_token, updated_at',
      head_table,
      (select string_agg(format('%I', key), ', ') from jsonb_object_keys(p_fields) key),
      (select string_agg(format('r.%I', key), ', ') from jsonb_object_keys(p_fields) key),
      head_table
    ) using p_fields into doc_id, doc_no, token, ver;
  end if;

  execute format('delete from public.%I where %I = $1', line_table, fk) using doc_id;
  execute format(
    'insert into public.%I (%I, sort_order, section_name, item, specification, quantity, unit, unit_price)
     select $1, (r ->> ''sort_order'')::integer, coalesce(r ->> ''section_name'', ''''), r ->> ''item'',
            coalesce(r ->> ''specification'', ''''), (r ->> ''quantity'')::numeric, coalesce(r ->> ''unit'', ''''),
            (r ->> ''unit_price'')::numeric
     from jsonb_array_elements(coalesce($2, ''[]''::jsonb)) r',
    line_table, fk
  ) using doc_id, p_lines;

  execute format('delete from public.%I where %I = $1', milestone_table, fk) using doc_id;
  execute format(
    'insert into public.%I (%I, sort_order, label, percent)
     select $1, (r ->> ''sort_order'')::integer, r ->> ''label'', (r ->> ''percent'')::numeric
     from jsonb_array_elements(coalesce($2, ''[]''::jsonb)) r',
    milestone_table, fk
  ) using doc_id, p_milestones;

  return jsonb_build_object('id', doc_id, 'document_no', doc_no, 'verify_token', token, 'version', ver);
end;
$$;
revoke all on function public.save_business_document(text, uuid, timestamptz, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.save_business_document(text, uuid, timestamptz, jsonb, jsonb, jsonb) to authenticated;

-- M6/L5: one accrual definition of open receivables and payables as of a day:
-- invoices (bills) issued on or before the day, less payments made on or before
-- the day, per document, never below zero. Overpayments are customer (vendor)
-- advances, not negative receivables (payables).
create or replace function private.report_ar_open(p_as_of date)
returns numeric
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(sum(greatest(ci.amount - coalesce((
    select sum(cp.amount) from public.client_payments cp
    where cp.client_invoice_id = ci.id and cp.paid_on <= p_as_of
  ), 0), 0)), 0)
  from public.client_invoices ci
  where ci.status is distinct from 'void'
    and coalesce(ci.issued_on, ci.created_at::date) <= p_as_of;
$$;

create or replace function private.report_ap_open(p_as_of date)
returns numeric
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(sum(greatest(vi.amount - coalesce((
    select sum(vp.amount) from public.vendor_payments vp
    where vp.vendor_invoice_id = vi.id and vp.paid_on <= p_as_of
  ), 0), 0)), 0)
  from public.vendor_invoices vi
  where vi.status is distinct from 'void'
    and coalesce(vi.issued_on, vi.created_at::date) <= p_as_of;
$$;
revoke all on function private.report_ar_open(date), private.report_ap_open(date) from public, anon, authenticated;

-- L7: activity search also matches changed field values.
alter table public.activity_log
  add column if not exists search_text text
  generated always as (
    coalesce(summary, '') || ' ' || coalesce(record_label, '') || ' '
    || coalesce(old_values::text, '') || ' ' || coalesce(new_values::text, '')
  ) stored;

-- Money views: rows need can(<module>,'view'); money columns need owner or Show Financial Figures.
create or replace view public.accounts_payable with (security_invoker=true) as
select s.id, s.due_date, s.current_status, s.purchase_order_id, s.project_id, s.project_name, s.vendor_id, s.vendor_name, (case when private.sees_money() then s.total_payable end)::numeric(14,2) as total_payable, (case when private.sees_money() then s.total_paid end)::numeric(14,2) as total_paid, (case when private.sees_money() then s.pending_payable end)::numeric(14,2) as pending_payable, s.issued_on, s.created_at, s.vendor_field, s.work_type
from (
SELECT po.id,
    due.due_date,
        CASE
            WHEN ((po.total_value > (0)::numeric) AND (COALESCE(paid.total_paid, (0)::numeric) >= po.total_value)) THEN 'paid'::payment_status
            WHEN (COALESCE(paid.total_paid, (0)::numeric) > (0)::numeric) THEN 'partial'::payment_status
            ELSE 'unpaid'::payment_status
        END AS current_status,
    po.id AS purchase_order_id,
    po.project_id,
    p.name AS project_name,
    v.id AS vendor_id,
    COALESCE(v.person_name, v.company_name) AS vendor_name,
    po.total_value AS total_payable,
    (COALESCE(paid.total_paid, (0)::numeric))::numeric(14,2) AS total_paid,
    (GREATEST((po.total_value - COALESCE(paid.total_paid, (0)::numeric)), (0)::numeric))::numeric(14,2) AS pending_payable,
    po.issued_on,
    po.created_at,
    v.vendor_field,
    po.work_type
   FROM ((((vendor_purchase_orders po
     JOIN projects p ON ((p.id = po.project_id)))
     JOIN vendors v ON ((v.id = po.vendor_id)))
     LEFT JOIN LATERAL ( SELECT COALESCE(sum(vp.amount), (0)::numeric) AS total_paid
           FROM (vendor_invoices vi
             JOIN vendor_payments vp ON ((vp.vendor_invoice_id = vi.id)))
          WHERE (vi.purchase_order_id = po.id)) paid ON (true))
     LEFT JOIN LATERAL ( SELECT min(vi.due_on) AS due_date
           FROM vendor_invoices vi
          WHERE ((vi.purchase_order_id = po.id) AND (vi.status <> 'void'::payment_status) AND (vi.due_on IS NOT NULL) AND (COALESCE(( SELECT sum(vp.amount) AS sum
                   FROM vendor_payments vp
                  WHERE (vp.vendor_invoice_id = vi.id)), (0)::numeric) < vi.amount))) due ON (true))
) s
where private.can('accounts_payable', 'view');

create or replace view public.accounts_payable_aging with (security_invoker=true) as
select s.id, s.due_date, s.current_status, s.purchase_order_id, s.project_id, s.project_name, s.vendor_id, s.vendor_name, (case when private.sees_money() then s.total_payable end)::numeric(14,2) as total_payable, (case when private.sees_money() then s.total_paid end)::numeric(14,2) as total_paid, (case when private.sees_money() then s.pending_payable end)::numeric(14,2) as pending_payable, s.issued_on, s.created_at, s.aging_bucket, s.days_past_due
from (
SELECT id,
    due_date,
    current_status,
    purchase_order_id,
    project_id,
    project_name,
    vendor_id,
    vendor_name,
    total_payable,
    total_paid,
    pending_payable,
    issued_on,
    created_at,
        CASE
            WHEN (pending_payable <= (0)::numeric) THEN 'paid'::text
            WHEN (due_date IS NULL) THEN 'no_due_date'::text
            WHEN (CURRENT_DATE <= due_date) THEN 'current'::text
            WHEN ((CURRENT_DATE - due_date) <= 30) THEN '1_30'::text
            WHEN ((CURRENT_DATE - due_date) <= 60) THEN '31_60'::text
            WHEN ((CURRENT_DATE - due_date) <= 90) THEN '61_90'::text
            ELSE '90_plus'::text
        END AS aging_bucket,
    GREATEST((CURRENT_DATE - due_date), 0) AS days_past_due
   FROM accounts_payable ap
) s
where private.can('accounts_payable', 'view');

create or replace view public.ap_aging_summary with (security_invoker=true) as
select s.aging_bucket, s.invoice_count, (case when private.sees_money() then s.amount_pending end)::numeric(14,2) as amount_pending
from (
SELECT aging_bucket,
    count(*) AS invoice_count,
    (COALESCE(sum(pending_payable), (0)::numeric))::numeric(14,2) AS amount_pending
   FROM accounts_payable_aging
  WHERE (pending_payable > (0)::numeric)
  GROUP BY aging_bucket
) s
where private.can('accounts_payable', 'view');

create or replace view public.accounts_receivable with (security_invoker=true) as
select s.id, s.due_date, s.current_status, s.project_id, s.project_name, s.client_id, s.client_name, (case when private.sees_money() then s.billed_amount end)::numeric(14,2) as billed_amount, (case when private.sees_money() then s.paid end)::numeric(14,2) as paid, (case when private.sees_money() then s.due end)::numeric(14,2) as due, s.issued_on, s.created_at
from (
SELECT ci.id,
    ci.due_on AS due_date,
    ci.status AS current_status,
    ci.project_id,
    p.name AS project_name,
    c.id AS client_id,
    COALESCE(c.person_name, c.company_name) AS client_name,
    ci.amount AS billed_amount,
    (COALESCE(sum(cp.amount), (0)::numeric))::numeric(14,2) AS paid,
    (GREATEST((ci.amount - COALESCE(sum(cp.amount), (0)::numeric)), (0)::numeric))::numeric(14,2) AS due,
    ci.issued_on,
    ci.created_at
   FROM (((client_invoices ci
     JOIN projects p ON ((p.id = ci.project_id)))
     JOIN clients c ON ((c.id = ci.client_id)))
     LEFT JOIN client_payments cp ON ((cp.client_invoice_id = ci.id)))
  WHERE (ci.status <> 'void'::payment_status)
  GROUP BY ci.id, p.id, c.id
) s
where private.can('accounts_receivable', 'view');

create or replace view public.accounts_receivable_aging with (security_invoker=true) as
select s.id, s.due_date, s.current_status, s.project_id, s.project_name, s.client_id, s.client_name, (case when private.sees_money() then s.billed_amount end)::numeric(14,2) as billed_amount, (case when private.sees_money() then s.paid end)::numeric(14,2) as paid, (case when private.sees_money() then s.due end)::numeric(14,2) as due, s.issued_on, s.created_at, s.aging_bucket, s.days_past_due
from (
SELECT id,
    due_date,
    current_status,
    project_id,
    project_name,
    client_id,
    client_name,
    billed_amount,
    paid,
    due,
    issued_on,
    created_at,
        CASE
            WHEN (due <= (0)::numeric) THEN 'paid'::text
            WHEN (due_date IS NULL) THEN 'no_due_date'::text
            WHEN (CURRENT_DATE <= due_date) THEN 'current'::text
            WHEN ((CURRENT_DATE - due_date) <= 30) THEN '1_30'::text
            WHEN ((CURRENT_DATE - due_date) <= 60) THEN '31_60'::text
            WHEN ((CURRENT_DATE - due_date) <= 90) THEN '61_90'::text
            ELSE '90_plus'::text
        END AS aging_bucket,
    GREATEST((CURRENT_DATE - due_date), 0) AS days_past_due
   FROM accounts_receivable ar
) s
where private.can('accounts_receivable', 'view');

create or replace view public.ar_aging_summary with (security_invoker=true) as
select s.aging_bucket, s.invoice_count, (case when private.sees_money() then s.amount_due end)::numeric(14,2) as amount_due
from (
SELECT aging_bucket,
    count(*) AS invoice_count,
    (COALESCE(sum(due), (0)::numeric))::numeric(14,2) AS amount_due
   FROM accounts_receivable_aging
  WHERE (due > (0)::numeric)
  GROUP BY aging_bucket
) s
where private.can('accounts_receivable', 'view');

create or replace view public.asset_register with (security_invoker=true) as
select s.asset_id, s.purchase_date, s.name, s.category, s.quantity, (case when private.sees_money() then s.unit_cost end)::numeric(14,2) as unit_cost, (case when private.sees_money() then s.total_cost end)::numeric(14,2) as total_cost, s.lifespan_years, s.lifespan_months, s.months_used, (case when private.sees_money() then s.monthly_depreciation end)::numeric as monthly_depreciation, (case when private.sees_money() then s.current_value end)::numeric(14,2) as current_value, s.notes, s.created_at
from (
SELECT a.id AS asset_id,
    a.purchase_date,
    a.name,
    c.name AS category,
    a.quantity,
    a.unit_cost,
    a.total_cost,
    a.lifespan_years,
    ((a.lifespan_years * (12)::numeric))::numeric(10,2) AS lifespan_months,
    (LEAST((a.lifespan_years * (12)::numeric), GREATEST((0)::numeric, (((EXTRACT(year FROM age((CURRENT_DATE)::timestamp with time zone, (a.purchase_date)::timestamp with time zone)) * (12)::numeric) + EXTRACT(month FROM age((CURRENT_DATE)::timestamp with time zone, (a.purchase_date)::timestamp with time zone))) + (EXTRACT(day FROM age((CURRENT_DATE)::timestamp with time zone, (a.purchase_date)::timestamp with time zone)) / 30.0)))))::numeric(10,2) AS months_used,
        CASE
            WHEN ((a.lifespan_years * (12)::numeric) = (0)::numeric) THEN (0)::numeric
            ELSE round((a.total_cost / (a.lifespan_years * (12)::numeric)), 2)
        END AS monthly_depreciation,
    (GREATEST((0)::numeric, (a.total_cost - (LEAST((a.lifespan_years * (12)::numeric), GREATEST((0)::numeric, (((EXTRACT(year FROM age((CURRENT_DATE)::timestamp with time zone, (a.purchase_date)::timestamp with time zone)) * (12)::numeric) + EXTRACT(month FROM age((CURRENT_DATE)::timestamp with time zone, (a.purchase_date)::timestamp with time zone))) + (EXTRACT(day FROM age((CURRENT_DATE)::timestamp with time zone, (a.purchase_date)::timestamp with time zone)) / 30.0)))) * (a.total_cost / NULLIF((a.lifespan_years * (12)::numeric), (0)::numeric))))))::numeric(14,2) AS current_value,
    a.notes,
    a.created_at
   FROM (assets a
     LEFT JOIN asset_categories c ON ((c.id = a.category_id)))
) s
where private.can('assets', 'view');

create or replace view public.budget_vs_actual with (security_invoker=true) as
select s.budget_id, s.department_id, s.department, s.period_year, s.period_month, (case when private.sees_money() then s.allocated_budget end)::numeric(14,2) as allocated_budget, (case when private.sees_money() then s.actual_spent end)::numeric(14,2) as actual_spent, (case when private.sees_money() then s.variance end)::numeric(14,2) as variance
from (
WITH opex AS (
         SELECT oe.department_id,
            (EXTRACT(year FROM oe.expense_date))::integer AS period_year,
            (EXTRACT(month FROM oe.expense_date))::integer AS period_month,
            (COALESCE(sum(oe.amount), (0)::numeric))::numeric(14,2) AS spent
           FROM operational_expenses oe
          WHERE (oe.department_id IS NOT NULL)
          GROUP BY oe.department_id, ((EXTRACT(year FROM oe.expense_date))::integer), ((EXTRACT(month FROM oe.expense_date))::integer)
        ), payroll AS (
         SELECT e.department_id,
            pr.period_year,
            pr.period_month,
            (COALESCE(sum(pl.net_salary), (0)::numeric))::numeric(14,2) AS spent
           FROM ((payroll_lines pl
             JOIN payroll_runs pr ON ((pr.id = pl.payroll_run_id)))
             JOIN employees e ON ((e.id = pl.employee_id)))
          WHERE (e.department_id IS NOT NULL)
          GROUP BY e.department_id, pr.period_year, pr.period_month
        ), actual AS (
         SELECT s.department_id,
            s.period_year,
            s.period_month,
            (sum(s.spent))::numeric(14,2) AS actual_spent
           FROM ( SELECT opex.department_id,
                    opex.period_year,
                    opex.period_month,
                    opex.spent
                   FROM opex
                UNION ALL
                 SELECT payroll.department_id,
                    payroll.period_year,
                    payroll.period_month,
                    payroll.spent
                   FROM payroll) s
          GROUP BY s.department_id, s.period_year, s.period_month
        )
 SELECT b.id AS budget_id,
    d.id AS department_id,
    d.name AS department,
    b.period_year,
    b.period_month,
    b.allocated_budget,
    (COALESCE(a.actual_spent, (0)::numeric))::numeric(14,2) AS actual_spent,
    ((b.allocated_budget - COALESCE(a.actual_spent, (0)::numeric)))::numeric(14,2) AS variance
   FROM ((budgets b
     JOIN departments d ON ((d.id = b.department_id)))
     LEFT JOIN actual a ON (((a.department_id = b.department_id) AND (a.period_year = b.period_year) AND (a.period_month = b.period_month))))
) s
where private.can('budgets', 'view');

create or replace view public.client_summaries with (security_invoker=true) as
select s.client_id, s.kind, s.display_name, s.ongoing_projects, s.completed_projects, (case when private.sees_money() then s.total_project_value end)::numeric(14,2) as total_project_value, (case when private.sees_money() then s.total_paid end)::numeric(14,2) as total_paid, (case when private.sees_money() then s.total_pending end)::numeric(14,2) as total_pending, (case when private.sees_money() then s.gross_profit end)::numeric(14,2) as gross_profit, (case when private.sees_money() then s.gross_profit_pct end)::numeric as gross_profit_pct
from (
SELECT c.id AS client_id,
    c.kind,
    COALESCE(c.person_name, c.company_name) AS display_name,
    count(p.id) FILTER (WHERE (p.status = 'active'::project_status)) AS ongoing_projects,
    count(p.id) FILTER (WHERE (p.status = 'completed'::project_status)) AS completed_projects,
    (COALESCE(sum(pf.total_value), (0)::numeric))::numeric(14,2) AS total_project_value,
    (COALESCE(sum(pf.total_paid), (0)::numeric))::numeric(14,2) AS total_paid,
    (COALESCE(sum(pf.total_pending_due), (0)::numeric))::numeric(14,2) AS total_pending,
    (COALESCE(sum(pf.gross_profit), (0)::numeric))::numeric(14,2) AS gross_profit,
        CASE
            WHEN (COALESCE(sum(pf.total_paid), (0)::numeric) = (0)::numeric) THEN NULL::numeric
            ELSE round(((sum(pf.gross_profit) / NULLIF(sum(pf.total_paid), (0)::numeric)) * (100)::numeric), 1)
        END AS gross_profit_pct
   FROM ((clients c
     LEFT JOIN projects p ON ((p.client_id = c.id)))
     LEFT JOIN project_financials pf ON ((pf.project_id = p.id)))
  GROUP BY c.id
) s
where private.can('clients', 'view');

create or replace view public.income with (security_invoker=true) as
select s.income_id, s.invoice_id, s.project_id, s.project_name, s.client_id, s.client_name, (case when private.sees_money() then s.total_paid end)::numeric(14,2) as total_paid, s.payment_method, s.paid_on, s.remarks, s.reference, s.created_at
from (
SELECT cp.id AS income_id,
    ci.id AS invoice_id,
    ci.project_id,
    p.name AS project_name,
    ci.client_id,
    COALESCE(c.person_name, c.company_name) AS client_name,
    cp.amount AS total_paid,
    cp.method AS payment_method,
    cp.paid_on,
    COALESCE(cp.remarks, cp.notes) AS remarks,
    cp.reference,
    cp.created_at
   FROM (((client_payments cp
     JOIN client_invoices ci ON ((ci.id = cp.client_invoice_id)))
     JOIN projects p ON ((p.id = ci.project_id)))
     JOIN clients c ON ((c.id = ci.client_id)))
) s
where private.can('income', 'view');

create or replace view public.lead_pipeline with (security_invoker=true) as
select s.lead_id, s.lead_name, s.kind, s.phone, s.email, s.project_name, s.project_type, s.source, (case when private.sees_money() then s.estimated_value end)::numeric(14,2) as estimated_value, s.current_stage, s.status, s.probability, (case when private.sees_money() then s.weighted_value end)::numeric as weighted_value, s.converted_client_id, s.converted_project_id, s.created_at
from (
SELECT id AS lead_id,
    lead_name,
    kind,
    phone,
    email,
    project_name,
    project_type,
    source,
    estimated_value,
    current_stage,
    status,
    probability,
        CASE
            WHEN ((estimated_value IS NULL) OR (probability IS NULL)) THEN NULL::numeric
            ELSE round(((estimated_value * probability) / 100.0), 2)
        END AS weighted_value,
    converted_client_id,
    converted_project_id,
    created_at
   FROM leads l
) s
where private.can('leads', 'view');

create or replace view public.monthly_cashflow with (security_invoker=true) as
select s.period_year, s.period_month, (case when private.sees_money() then s.cash_in_income end)::numeric(14,2) as cash_in_income, (case when private.sees_money() then s.cash_out_expense end)::numeric(14,2) as cash_out_expense, (case when private.sees_money() then s.cash_out_operational end)::numeric(14,2) as cash_out_operational, (case when private.sees_money() then s.cash_out_payroll end)::numeric(14,2) as cash_out_payroll, (case when private.sees_money() then s.cash_out_total end)::numeric(14,2) as cash_out_total, (case when private.sees_money() then s.net_cashflow end)::numeric(14,2) as net_cashflow
from (
WITH income AS (
         SELECT (EXTRACT(year FROM cp.paid_on))::integer AS period_year,
            (EXTRACT(month FROM cp.paid_on))::integer AS period_month,
            (COALESCE(sum(cp.amount), (0)::numeric))::numeric(14,2) AS cash_in
           FROM client_payments cp
          GROUP BY ((EXTRACT(year FROM cp.paid_on))::integer), ((EXTRACT(month FROM cp.paid_on))::integer)
        ), expense AS (
         SELECT (EXTRACT(year FROM vp.paid_on))::integer AS period_year,
            (EXTRACT(month FROM vp.paid_on))::integer AS period_month,
            (COALESCE(sum(vp.amount), (0)::numeric))::numeric(14,2) AS cash_out_expense
           FROM vendor_payments vp
          GROUP BY ((EXTRACT(year FROM vp.paid_on))::integer), ((EXTRACT(month FROM vp.paid_on))::integer)
        ), opex AS (
         SELECT (EXTRACT(year FROM oe.expense_date))::integer AS period_year,
            (EXTRACT(month FROM oe.expense_date))::integer AS period_month,
            (COALESCE(sum(oe.amount), (0)::numeric))::numeric(14,2) AS cash_out_opex
           FROM operational_expenses oe
          GROUP BY ((EXTRACT(year FROM oe.expense_date))::integer), ((EXTRACT(month FROM oe.expense_date))::integer)
        ), payroll AS (
         SELECT pr.period_year,
            pr.period_month,
            (COALESCE(sum(pl.net_salary), (0)::numeric))::numeric(14,2) AS cash_out_payroll
           FROM (payroll_lines pl
             JOIN payroll_runs pr ON ((pr.id = pl.payroll_run_id)))
          GROUP BY pr.period_year, pr.period_month
        ), months AS (
         SELECT income.period_year,
            income.period_month
           FROM income
        UNION
         SELECT expense.period_year,
            expense.period_month
           FROM expense
        UNION
         SELECT opex.period_year,
            opex.period_month
           FROM opex
        UNION
         SELECT payroll.period_year,
            payroll.period_month
           FROM payroll
        )
 SELECT m.period_year,
    m.period_month,
    (COALESCE(i.cash_in, (0)::numeric))::numeric(14,2) AS cash_in_income,
    (COALESCE(e.cash_out_expense, (0)::numeric))::numeric(14,2) AS cash_out_expense,
    (COALESCE(o.cash_out_opex, (0)::numeric))::numeric(14,2) AS cash_out_operational,
    (COALESCE(p.cash_out_payroll, (0)::numeric))::numeric(14,2) AS cash_out_payroll,
    (((COALESCE(e.cash_out_expense, (0)::numeric) + COALESCE(o.cash_out_opex, (0)::numeric)) + COALESCE(p.cash_out_payroll, (0)::numeric)))::numeric(14,2) AS cash_out_total,
    ((((COALESCE(i.cash_in, (0)::numeric) - COALESCE(e.cash_out_expense, (0)::numeric)) - COALESCE(o.cash_out_opex, (0)::numeric)) - COALESCE(p.cash_out_payroll, (0)::numeric)))::numeric(14,2) AS net_cashflow
   FROM ((((months m
     LEFT JOIN income i ON (((i.period_year = m.period_year) AND (i.period_month = m.period_month))))
     LEFT JOIN expense e ON (((e.period_year = m.period_year) AND (e.period_month = m.period_month))))
     LEFT JOIN opex o ON (((o.period_year = m.period_year) AND (o.period_month = m.period_month))))
     LEFT JOIN payroll p ON (((p.period_year = m.period_year) AND (p.period_month = m.period_month))))
) s
where private.can('banking', 'view');

create or replace view public.operational_expense_details with (security_invoker=true) as
select s.operational_expense_id, s.expense_date, s.category, (case when private.sees_money() then s.total_expense end)::numeric(14,2) as total_expense, s.payment_method, s.project_id, s.project_name, s.notes, s.created_at
from (
SELECT oe.id AS operational_expense_id,
    oe.expense_date,
    oe.category,
    oe.amount AS total_expense,
    oe.payment_method,
    oe.project_id,
    p.name AS project_name,
    oe.notes,
    oe.created_at
   FROM (operational_expenses oe
     LEFT JOIN projects p ON ((p.id = oe.project_id)))
) s
where private.can('expenses', 'view');

create or replace view public.project_backlogs with (security_invoker=true) as
select s.project_id, s.project_name, s.client_name, (case when private.sees_money() then s.project_value end)::numeric(14,2) as project_value, (case when private.sees_money() then s.backlog_amount end)::numeric(14,2) as backlog_amount, (case when private.sees_money() then s.total_paid end)::numeric(14,2) as total_paid, (case when private.sees_money() then s.expense_total end)::numeric(14,2) as expense_total, s.project_status, s.recovery_plan
from (
SELECT pf.project_id,
    pf.project_name,
    COALESCE(c.person_name, c.company_name) AS client_name,
    pf.total_value AS project_value,
    pf.backlog_amount,
    pf.total_paid,
    pf.expense_total,
    p.status AS project_status,
    p.recovery_plan
   FROM ((project_financials pf
     JOIN clients c ON ((c.id = pf.client_id)))
     JOIN projects p ON ((p.id = pf.project_id)))
  WHERE (pf.backlog_amount > (0)::numeric)
) s
where private.can('backlog', 'view');

create or replace view public.project_expenses with (security_invoker=true) as
select s.expense_id, s.po_id, s.expense_date, s.project_id, s.project_name, s.vendor_id, s.vendor_name, (case when private.sees_money() then s.total_expense end)::numeric(14,2) as total_expense, s.payment_method, s.expense_category, s.reference, s.notes, s.created_at
from (
SELECT vp.id AS expense_id,
    po.id AS po_id,
    vp.paid_on AS expense_date,
    po.project_id,
    p.name AS project_name,
    v.id AS vendor_id,
    COALESCE(v.person_name, v.company_name) AS vendor_name,
    vp.amount AS total_expense,
    vp.method AS payment_method,
    vp.expense_category,
    vp.reference,
    vp.notes,
    vp.created_at
   FROM ((((vendor_payments vp
     JOIN vendor_invoices vi ON ((vi.id = vp.vendor_invoice_id)))
     JOIN vendor_purchase_orders po ON ((po.id = vi.purchase_order_id)))
     JOIN projects p ON ((p.id = po.project_id)))
     JOIN vendors v ON ((v.id = po.vendor_id)))
) s
where private.can('expense', 'view');

create or replace view public.project_financials with (security_invoker=true) as
select s.project_id, s.project_name, s.client_id, (case when private.sees_money() then s.total_value end)::numeric(14,2) as total_value, (case when private.sees_money() then s.total_paid end)::numeric(14,2) as total_paid, (case when private.sees_money() then s.total_pending_due end)::numeric(14,2) as total_pending_due, (case when private.sees_money() then s.expense_total end)::numeric(14,2) as expense_total, (case when private.sees_money() then s.expense_due end)::numeric(14,2) as expense_due, (case when private.sees_money() then s.gross_profit end)::numeric(14,2) as gross_profit, (case when private.sees_money() then s.backlog_amount end)::numeric(14,2) as backlog_amount
from (
WITH client_paid AS (
         SELECT ci.project_id,
            (COALESCE(sum(cp_1.amount), (0)::numeric))::numeric(14,2) AS total_paid
           FROM (client_invoices ci
             LEFT JOIN client_payments cp_1 ON ((cp_1.client_invoice_id = ci.id)))
          WHERE (ci.status <> 'void'::payment_status)
          GROUP BY ci.project_id
        ), po_committed AS (
         SELECT vendor_purchase_orders.project_id,
            (COALESCE(sum(vendor_purchase_orders.total_value), (0)::numeric))::numeric(14,2) AS committed_total
           FROM vendor_purchase_orders
          GROUP BY vendor_purchase_orders.project_id
        ), vendor_expense_paid AS (
         SELECT po.project_id,
            (COALESCE(sum(vp.amount), (0)::numeric))::numeric(14,2) AS paid_total
           FROM ((vendor_purchase_orders po
             LEFT JOIN vendor_invoices vi ON ((vi.purchase_order_id = po.id)))
             LEFT JOIN vendor_payments vp ON ((vp.vendor_invoice_id = vi.id)))
          GROUP BY po.project_id
        ), operational_expense_paid AS (
         SELECT operational_expenses.project_id,
            (COALESCE(sum(operational_expenses.amount), (0)::numeric))::numeric(14,2) AS paid_total
           FROM operational_expenses
          WHERE (operational_expenses.project_id IS NOT NULL)
          GROUP BY operational_expenses.project_id
        ), tax_paid AS (
         SELECT vat_tax_payments.project_id,
            (COALESCE(sum(vat_tax_payments.amount), (0)::numeric))::numeric(14,2) AS paid_total
           FROM vat_tax_payments
          GROUP BY vat_tax_payments.project_id
        )
 SELECT p.id AS project_id,
    p.name AS project_name,
    p.client_id,
    p.total_value,
    (COALESCE(cp.total_paid, (0)::numeric))::numeric(14,2) AS total_paid,
    (GREATEST((p.total_value - COALESCE(cp.total_paid, (0)::numeric)), (0)::numeric))::numeric(14,2) AS total_pending_due,
    ((COALESCE(vep.paid_total, (0)::numeric) + COALESCE(oep.paid_total, (0)::numeric)))::numeric(14,2) AS expense_total,
    (GREATEST((COALESCE(poc.committed_total, (0)::numeric) - COALESCE(vep.paid_total, (0)::numeric)), (0)::numeric))::numeric(14,2) AS expense_due,
    (((COALESCE(cp.total_paid, (0)::numeric) - (COALESCE(vep.paid_total, (0)::numeric) + COALESCE(oep.paid_total, (0)::numeric))) - COALESCE(tp.paid_total, (0)::numeric)))::numeric(14,2) AS gross_profit,
    (
        CASE
            WHEN ((COALESCE(vep.paid_total, (0)::numeric) + COALESCE(oep.paid_total, (0)::numeric)) > COALESCE(cp.total_paid, (0)::numeric)) THEN ((COALESCE(vep.paid_total, (0)::numeric) + COALESCE(oep.paid_total, (0)::numeric)) - COALESCE(cp.total_paid, (0)::numeric))
            ELSE (0)::numeric
        END)::numeric(14,2) AS backlog_amount
   FROM (((((projects p
     LEFT JOIN client_paid cp ON ((cp.project_id = p.id)))
     LEFT JOIN po_committed poc ON ((poc.project_id = p.id)))
     LEFT JOIN vendor_expense_paid vep ON ((vep.project_id = p.id)))
     LEFT JOIN operational_expense_paid oep ON ((oep.project_id = p.id)))
     LEFT JOIN tax_paid tp ON ((tp.project_id = p.id)))
) s
where private.can('projects', 'view');

create or replace view public.vat_tax_by_project with (security_invoker=true) as
select s.vat_tax_id, s.project_id, s.project_name, s.paid_on, (case when private.sees_money() then s.vat_tax_paid end)::numeric(14,2) as vat_tax_paid, s.payment_method, s.notes, s.created_at
from (
SELECT v.id AS vat_tax_id,
    v.project_id,
    p.name AS project_name,
    v.paid_on,
    v.amount AS vat_tax_paid,
    v.payment_method,
    v.notes,
    v.created_at
   FROM (vat_tax_payments v
     JOIN projects p ON ((p.id = v.project_id)))
) s
where private.can('vat_tax', 'view');

create or replace view public.vendor_po_balances with (security_invoker=false) as
select s.purchase_order_id, s.project_id, s.vendor_id, (case when private.sees_money() then s.total_value end)::numeric(14,2) as total_value, (case when private.sees_money() then s.total_paid end)::numeric(14,2) as total_paid, (case when private.sees_money() then s.total_pending end)::numeric(14,2) as total_pending
from (
SELECT po.id AS purchase_order_id,
    po.project_id,
    po.vendor_id,
    po.total_value,
    (
        CASE
            WHEN (private.can('vendor_payments'::text, 'view'::text) AND private.sees_financials()) THEN COALESCE(sum(vp.amount), (0)::numeric)
            ELSE NULL::numeric
        END)::numeric(14,2) AS total_paid,
    (
        CASE
            WHEN (private.can('vendor_payments'::text, 'view'::text) AND private.sees_financials()) THEN GREATEST((po.total_value - COALESCE(sum(vp.amount), (0)::numeric)), (0)::numeric)
            ELSE NULL::numeric
        END)::numeric(14,2) AS total_pending
   FROM ((vendor_purchase_orders po
     LEFT JOIN vendor_invoices vi ON ((vi.purchase_order_id = po.id)))
     LEFT JOIN vendor_payments vp ON ((vp.vendor_invoice_id = vi.id)))
  WHERE (private.can('purchase_orders'::text, 'view'::text) OR private.can('vendor_payments'::text, 'view'::text) OR private.can('accounts_payable'::text, 'view'::text) OR private.can('expense'::text, 'view'::text) OR private.can('dashboard'::text, 'view'::text))
  GROUP BY po.id
) s
where private.can('purchase_orders', 'view');

create or replace view public.vendor_summaries with (security_invoker=true) as
select s.vendor_id, s.kind, s.display_name, s.vendor_field, (case when private.sees_money() then s.total_po_value end)::numeric(14,2) as total_po_value, (case when private.sees_money() then s.total_paid end)::numeric(14,2) as total_paid, (case when private.sees_money() then s.total_due end)::numeric(14,2) as total_due
from (
SELECT v.id AS vendor_id,
    v.kind,
    COALESCE(v.person_name, v.company_name) AS display_name,
    v.vendor_field,
    (COALESCE(sum(b.total_value), (0)::numeric))::numeric(14,2) AS total_po_value,
    (
        CASE
            WHEN (private.can('vendor_payments'::text, 'view'::text) AND private.sees_financials()) THEN COALESCE(sum(b.total_paid), (0)::numeric)
            ELSE NULL::numeric
        END)::numeric(14,2) AS total_paid,
    (
        CASE
            WHEN (private.can('vendor_payments'::text, 'view'::text) AND private.sees_financials()) THEN COALESCE(sum(b.total_pending), (0)::numeric)
            ELSE NULL::numeric
        END)::numeric(14,2) AS total_due
   FROM (vendors v
     LEFT JOIN vendor_po_balances b ON ((b.vendor_id = v.id)))
  GROUP BY v.id
) s
where private.can('vendors', 'view');

-- L5: AP aging uses vendor bills, the same basis as the Balance Sheet.
CREATE OR REPLACE FUNCTION private.report_ap_aging(p_to date)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  with open_items as (
    select
      coalesce(nullif(btrim(v.person_name), ''), nullif(btrim(v.company_name), ''), 'Vendor') as party,
      coalesce(nullif(btrim(p.name), ''), 'Operational') as project,
      coalesce(nullif(btrim(po.work_type), ''), 'Vendor Bill') as reference,
      coalesce(vi.due_on, vi.issued_on) as due_on,
      (least(p_to, (timezone('Asia/Dhaka', now()))::date) - coalesce(vi.due_on, vi.issued_on))::integer as days,
      private.report_money(vi.amount - coalesce(paid.total_paid, 0)) as amount
    from public.vendor_invoices vi
    join public.vendor_purchase_orders po on po.id = vi.purchase_order_id
    join public.vendors v on v.id = po.vendor_id
    left join public.projects p on p.id = po.project_id
    left join lateral (
      select coalesce(sum(vp.amount), 0) as total_paid
      from public.vendor_payments vp
      where vp.vendor_invoice_id = vi.id
        and vp.paid_on <= p_to
    ) paid on true
    where vi.status is distinct from 'void'
      and coalesce(vi.issued_on, vi.created_at::date) <= p_to
      and vi.amount - coalesce(paid.total_paid, 0) > 0
  ),
  bucketed as (
    select *, private.report_aging_bucket(days) as bucket from open_items
  )
  select jsonb_build_object(
    'buckets', (
      select jsonb_agg(
        jsonb_build_object(
          'label', label,
          'amount', private.report_money(amount),
          'count', item_count
        )
        order by sort_order
      )
      from (
        select
          bucket.label,
          bucket.sort_order,
          coalesce(sum(b.amount), 0) as amount,
          count(b.amount)::integer as item_count
        from (
          values ('0-30', 1), ('31-60', 2), ('61-90', 3), ('90+', 4)
        ) as bucket(label, sort_order)
        left join bucketed b on b.bucket = bucket.label
        group by bucket.label, bucket.sort_order
      ) totals
    ),
    'rows', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'party', party,
          'project', project,
          'reference', reference,
          'due_on', due_on,
          'days', days,
          'bucket', bucket,
          'amount', amount
        )
        order by days desc, party, project
      )
      from bucketed
    ), '[]'::jsonb),
    'total', private.report_money((select sum(amount) from bucketed))
  );
$function$;

-- M6: Balance Sheet AR = open invoices as of the day (same as AR aging); overpayments are Customer Advances.
CREATE OR REPLACE FUNCTION public.financial_report(p_from date, p_to date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_owner boolean := private.is_owner();
  v_financial boolean := private.sees_financials();
  v_books boolean;
  v_bank boolean;
  v_ar boolean;
  v_ap boolean;
  v_assets boolean;
  v_projects boolean;
  v_profit jsonb;
  v_revenue numeric;
  v_material numeric;
  v_subcontractor numeric;
  v_overhead numeric;
  v_operational numeric;
  v_marketing numeric;
  v_salary numeric;
  v_admin numeric;
  v_tax numeric;
  v_project_expense numeric;
  v_admin_expense numeric;
  v_gross numeric;
  v_net numeric;
  v_launch date;
  v_cash numeric;
  v_opening numeric;
  v_closing numeric;
  v_ar_total numeric := 0;
  v_ap_total numeric := 0;
  v_asset_total numeric := 0;
  v_deposits numeric := 0;
  v_withdrawals numeric := 0;
  v_equity numeric := 0;
  v_asset_sum numeric := 0;
  v_liability_sum numeric := 0;
  v_lines jsonb := '[]'::jsonb;
  v_signed numeric;
  v_label text;
  v_result jsonb;
  v_depreciation numeric := 0;
  v_ar_net numeric := 0;
  v_ar_adv numeric := 0;
  v_ap_adv numeric := 0;
  v_ap_net numeric := 0;
  v_asset_cost numeric := 0;
  v_other numeric := 0;
  v_capital numeric := 0;
begin
  if auth.uid() is null or p_from is null or p_to is null or p_from > p_to then
    return jsonb_build_object('allowed', false);
  end if;

  if not v_owner and not v_financial then
    return jsonb_build_object('allowed', false);
  end if;

  v_books := v_owner or (
    private.can('income', 'view')
    and private.can('client_invoices', 'view')
    and private.can('vendor_payments', 'view')
    and private.can('purchase_orders', 'view')
    and private.can('expenses', 'view')
    and private.can('vat_tax', 'view')
    and private.can('banking', 'view')
  );
  v_bank := v_owner or private.can('banking', 'view');
  v_ar := v_owner or private.can('accounts_receivable', 'view') or private.can('client_invoices', 'view');
  v_ap := v_owner or private.can('accounts_payable', 'view') or private.can('purchase_orders', 'view');
  v_assets := v_owner or private.can('assets', 'view');
  v_projects := v_owner or (private.can('projects', 'view') and private.can('clients', 'view'));

  v_result := jsonb_build_object(
    'allowed', true,
    'from', p_from,
    'to', p_to
  );

  if v_books then
    v_profit := private.report_profit_accrual(p_from, p_to);
    v_revenue := (v_profit->>'revenue')::numeric;
    v_material := (v_profit->>'material')::numeric;
    v_subcontractor := (v_profit->>'subcontractor')::numeric;
    v_overhead := (v_profit->>'project_overhead')::numeric;
    v_operational := (v_profit->>'operational')::numeric;
    v_marketing := (v_profit->>'marketing')::numeric;
    v_salary := (v_profit->>'salary')::numeric;
    v_admin := (v_profit->>'admin')::numeric;
    v_tax := (v_profit->>'tax')::numeric;
    v_depreciation := (v_profit->>'depreciation')::numeric;
    v_project_expense := private.report_money(v_material + v_subcontractor + v_overhead);
    v_admin_expense := private.report_money(v_operational + v_marketing + v_salary + v_admin + v_depreciation);
    v_gross := private.report_money(v_revenue - v_project_expense - v_tax);
    v_net := private.report_money(v_gross - v_admin_expense);

    v_result := v_result || jsonb_build_object(
      'profit_and_loss', jsonb_build_object(
        'lines', jsonb_build_array(
          jsonb_build_object('label', 'Project Revenue', 'amount', v_revenue, 'emphasis', 'plain'),
          jsonb_build_object('label', 'Material Cost', 'amount', v_material, 'emphasis', 'plain'),
          jsonb_build_object('label', 'Subcontractor Cost', 'amount', v_subcontractor, 'emphasis', 'plain'),
          jsonb_build_object('label', 'Project Overhead', 'amount', v_overhead, 'emphasis', 'plain'),
          jsonb_build_object('label', 'Project Expense', 'amount', v_project_expense, 'emphasis', 'subtotal'),
          jsonb_build_object('label', 'Tax', 'amount', v_tax, 'emphasis', 'plain'),
          jsonb_build_object('label', 'Gross Profit', 'amount', v_gross, 'emphasis', 'total'),
          jsonb_build_object('label', 'Operational Expense', 'amount', v_operational, 'emphasis', 'plain'),
          jsonb_build_object('label', 'Marketing', 'amount', v_marketing, 'emphasis', 'plain'),
          jsonb_build_object('label', 'Salaries', 'amount', v_salary, 'emphasis', 'plain'),
          jsonb_build_object('label', 'Office And Admin', 'amount', v_admin, 'emphasis', 'plain'),
          jsonb_build_object('label', 'Depreciation', 'amount', v_depreciation, 'emphasis', 'plain'),
          jsonb_build_object('label', 'Admin Expense', 'amount', v_admin_expense, 'emphasis', 'subtotal'),
          jsonb_build_object('label', 'Net Profit', 'amount', v_net, 'emphasis', 'total')
        )
      )
    );
  else
    v_result := v_result || jsonb_build_object('profit_and_loss', null);
  end if;

  if v_bank then
    select coalesce(sum(opening_balance), 0) into v_opening from public.bank_accounts;
    v_opening := private.report_money(v_opening + coalesce((
      select sum(case when direction = 'inflow' then amount else -amount end)
      from public.bank_transactions
      where transaction_date < p_from
    ), 0));
    v_closing := private.report_money((
      select coalesce(sum(opening_balance), 0) from public.bank_accounts
    ) + coalesce((
      select sum(case when direction = 'inflow' then amount else -amount end)
      from public.bank_transactions
      where transaction_date <= p_to
    ), 0));

    v_lines := '[]'::jsonb;
    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object('label', 'Opening Cash', 'amount', v_opening, 'emphasis', 'plain')
    );

    for v_signed, v_label in
      select
        private.report_money(sum(case when bt.direction = 'inflow' then bt.amount else -bt.amount end)),
        case bt.source_kind
          when 'project_income' then 'Client Collections'
          when 'vendor_expense' then 'Vendor Payments'
          when 'operational_expense' then 'Operational Expenses'
          when 'vat_tax' then 'Tax Payments'
          when 'payroll' then 'Payroll'
          when 'deposit' then 'Owner Deposits'
          when 'withdrawal' then 'Owner Withdrawals'
          when 'transfer' then 'Internal Transfers'
          else 'Other'
        end
      from public.bank_transactions bt
      where bt.transaction_date between p_from and p_to
      group by 2
      order by 2
    loop
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object('label', v_label, 'amount', v_signed, 'emphasis', 'plain')
      );
    end loop;

    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object('label', 'Net Change In Cash', 'amount', private.report_money(v_closing - v_opening), 'emphasis', 'subtotal'),
      jsonb_build_object('label', 'Closing Cash', 'amount', v_closing, 'emphasis', 'total')
    );
    v_result := v_result || jsonb_build_object('cash_flow', jsonb_build_object('lines', v_lines));
  else
    v_result := v_result || jsonb_build_object('cash_flow', null);
  end if;

  if v_ar or v_ap or v_assets or v_bank or v_books then
    -- Accrual balance sheet as of p_to. Assets = Cash + net receivables + fixed
    -- assets (cost less depreciation). Liabilities = net payables (vendor bills
    -- less vendor payments) plus customer advances. Equity = opening capital +
    -- assets added + owner deposits - withdrawals + other bank movements +
    -- retained earnings (accrual net profit from the start of the books).
    v_lines := '[]'::jsonb;
    v_asset_sum := 0;
    v_liability_sum := 0;
    v_equity := 0;

    if v_bank then
      v_cash := private.report_money((
        select coalesce(sum(opening_balance), 0) from public.bank_accounts
      ) + coalesce((
        select sum(case when direction = 'inflow' then amount else -amount end)
        from public.bank_transactions
        where transaction_date <= p_to
      ), 0));
      v_asset_sum := v_asset_sum + v_cash;
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object('label', 'Cash And Bank', 'amount', v_cash, 'emphasis', 'plain')
      );
    end if;

    if v_ar then
      v_ar_net := private.report_money(
        coalesce((
          select sum(ci.amount)
          from public.client_invoices ci
          where ci.status is distinct from 'void'
            and coalesce(ci.issued_on, ci.created_at::date) <= p_to
        ), 0)
        - coalesce((
          select sum(cp.amount)
          from public.client_payments cp
          where cp.paid_on <= p_to
        ), 0)
      );
      v_ar_total := private.report_ar_open(p_to);
      v_ar_adv := greatest(v_ar_total - v_ar_net, 0);
      v_asset_sum := v_asset_sum + v_ar_total;
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object('label', 'Accounts Receivable', 'amount', v_ar_total, 'emphasis', 'plain')
      );
    end if;

    if v_ap then
      v_ap_net := private.report_money(
        coalesce((
          select sum(vi.amount)
          from public.vendor_invoices vi
          where vi.status is distinct from 'void'
            and coalesce(vi.issued_on, vi.created_at::date) <= p_to
        ), 0)
        - coalesce((
          select sum(vp.amount)
          from public.vendor_payments vp
          where vp.paid_on <= p_to
        ), 0)
      );
      v_ap_total := private.report_ap_open(p_to);
      v_ap_adv := greatest(v_ap_total - v_ap_net, 0);
      if v_ap_adv > 0 then
        v_asset_sum := v_asset_sum + v_ap_adv;
        v_lines := v_lines || jsonb_build_array(
          jsonb_build_object('label', 'Vendor Advances', 'amount', v_ap_adv, 'emphasis', 'plain')
        );
      end if;
    end if;

    if v_assets then
      select
        private.report_money(coalesce(sum(coalesce(a.total_cost, a.unit_cost * a.quantity)), 0))
      into v_asset_cost
      from public.assets a
      where a.purchase_date <= p_to;
      v_asset_total := private.report_money(v_asset_cost - private.report_accumulated_depreciation(p_to));
      v_asset_sum := v_asset_sum + v_asset_total;
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object('label', 'Fixed Assets', 'amount', v_asset_total, 'emphasis', 'plain')
      );
    end if;

    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object('label', 'Total Assets', 'amount', private.report_money(v_asset_sum), 'emphasis', 'total')
    );

    if v_ap or v_ar then
      if v_ap then
        v_liability_sum := v_liability_sum + v_ap_total;
        v_lines := v_lines || jsonb_build_array(
          jsonb_build_object('label', 'Accounts Payable', 'amount', v_ap_total, 'emphasis', 'plain')
        );
      end if;
      if v_ar and v_ar_adv > 0 then
        v_liability_sum := v_liability_sum + v_ar_adv;
        v_lines := v_lines || jsonb_build_array(
          jsonb_build_object('label', 'Customer Advances', 'amount', v_ar_adv, 'emphasis', 'plain')
        );
      end if;
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object('label', 'Total Liabilities', 'amount', private.report_money(v_liability_sum), 'emphasis', 'total')
      );
    end if;

    if v_bank then
      select coalesce(sum(opening_balance), 0) into v_capital from public.bank_accounts;
      v_capital := private.report_money(v_capital);
      select private.report_money(sum(case when direction = 'inflow' then amount else -amount end))
      into v_deposits
      from public.bank_transactions
      where transaction_date <= p_to
        and source_kind = 'deposit';
      select private.report_money(sum(case when direction = 'inflow' then amount else -amount end))
      into v_withdrawals
      from public.bank_transactions
      where transaction_date <= p_to
        and source_kind = 'withdrawal';
      select private.report_money(sum(case when direction = 'inflow' then amount else -amount end))
      into v_other
      from public.bank_transactions
      where transaction_date <= p_to
        and source_kind in ('other', 'transfer');
      v_deposits := coalesce(v_deposits, 0);
      v_withdrawals := coalesce(v_withdrawals, 0);
      v_other := coalesce(v_other, 0);
      v_equity := v_capital + v_deposits + v_withdrawals;
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object('label', 'Opening Capital', 'amount', v_capital, 'emphasis', 'plain'),
        jsonb_build_object('label', 'Owner Deposits', 'amount', v_deposits, 'emphasis', 'plain'),
        jsonb_build_object('label', 'Owner Withdrawals', 'amount', v_withdrawals, 'emphasis', 'plain')
      );
      if v_other <> 0 then
        v_equity := v_equity + v_other;
        v_lines := v_lines || jsonb_build_array(
          jsonb_build_object('label', 'Other Bank Adjustments', 'amount', v_other, 'emphasis', 'plain')
        );
      end if;
    end if;

    if v_assets then
      v_equity := v_equity + v_asset_cost;
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object('label', 'Assets Added', 'amount', v_asset_cost, 'emphasis', 'plain')
      );
    end if;

    if v_books then
      v_profit := private.report_profit_accrual(date '0001-01-01', p_to);
      v_net := private.report_money(
        (v_profit->>'revenue')::numeric
        - (v_profit->>'material')::numeric
        - (v_profit->>'subcontractor')::numeric
        - (v_profit->>'project_overhead')::numeric
        - (v_profit->>'tax')::numeric
        - (v_profit->>'operational')::numeric
        - (v_profit->>'marketing')::numeric
        - (v_profit->>'salary')::numeric
        - (v_profit->>'admin')::numeric
        - (v_profit->>'depreciation')::numeric
      );
      v_equity := v_equity + v_net;
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object('label', 'Retained Earnings', 'amount', v_net, 'emphasis', 'plain')
      );
    end if;

    if v_books or v_bank then
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object('label', 'Total Equity', 'amount', private.report_money(v_equity), 'emphasis', 'total')
      );
    end if;

    if v_bank and v_ar and v_assets and v_ap and v_books then
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object(
          'label', 'Difference',
          'amount', private.report_money(v_asset_sum - v_liability_sum - v_equity),
          'emphasis', 'plain'
        )
      );
    end if;

    v_result := v_result || jsonb_build_object(
      'balance_sheet', jsonb_build_object(
        'lines', v_lines,
        'partial', not (v_bank and v_ar and v_assets and v_ap and v_books)
      )
    );
  else
    v_result := v_result || jsonb_build_object('balance_sheet', null);
  end if;

  if v_ar then
    v_result := v_result || jsonb_build_object('ar_aging', private.report_ar_aging(p_to));
  else
    v_result := v_result || jsonb_build_object('ar_aging', null);
  end if;

  if v_ap then
    v_result := v_result || jsonb_build_object('ap_aging', private.report_ap_aging(p_to));
  else
    v_result := v_result || jsonb_build_object('ap_aging', null);
  end if;

  if v_books and v_projects then
    v_result := v_result || jsonb_build_object(
      'project_profitability', private.report_project_profit(p_from, p_to)
    );
  else
    v_result := v_result || jsonb_build_object('project_profitability', null);
  end if;

  if v_owner or private.can('vat_tax', 'view') then
    v_result := v_result || jsonb_build_object('tax', private.report_tax(p_from, p_to));
  else
    v_result := v_result || jsonb_build_object('tax', null);
  end if;

  return v_result;
end;
$function$;

-- M6/L5/L6: dashboard receivables and payables use the report definitions; collection efficiency =
-- cash collected on the scope's projects / their contract value.
CREATE OR REPLACE FUNCTION public.dashboard_scope(p_year integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_today date := (timezone('Asia/Dhaka', now()))::date;
  v_current integer := extract(year from v_today)::integer;
  v_year integer := p_year;
  v_from date;
  v_to date;
  v_forecast_to date;
  v_prior_from date;
  v_prior_to date;
  v_parts jsonb;
  v_prior jsonb;
  v_forecast jsonb;
  v_revenue numeric;
  v_expense numeric;
  v_gross numeric;
  v_net numeric;
  v_project numeric;
  v_admin numeric;
  v_billed numeric;
  v_paid numeric;
  v_receivables numeric;
  v_payables numeric;
  v_cash numeric;
  v_prev_cash numeric;
  v_prev_month date;
  v_contract numeric;
  v_won integer;
  v_lost integer;
  v_clients integer;
  v_projects integer;
  v_high integer;
  v_low integer;
  v_active integer;
  v_open_leads integer;
  v_lead_value numeric;
  v_backlog integer;
  v_since integer;
  v_launch date;
  v_span_start date;
  v_span_end date;
  v_days integer;
  v_sparks jsonb := '[]'::jsonb;
  v_gross_spark jsonb := '[]'::jsonb;
  v_net_spark jsonb := '[]'::jsonb;
  v_expense_spark jsonb := '[]'::jsonb;
  v_cash_spark jsonb := '[]'::jsonb;
  v_annual jsonb := '[]'::jsonb;
  v_trend jsonb := '[]'::jsonb;
  v_weeks jsonb := '[]'::jsonb;
  v_years jsonb := '[]'::jsonb;
  v_first integer;
  v_cursor integer;
  v_month integer;
  v_last_month integer;
  v_month_start date;
  v_month_end date;
  v_slice jsonb;
  v_week_start date;
  v_week_end date;
  v_offset integer;
  v_label text;
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

  if v_year is not null and (v_year < 2021 or v_year > v_current) then
    v_year := v_current;
  end if;

  if v_year is null then
    v_from := date '0001-01-01';
    v_to := v_today;
    v_forecast_to := date '9999-12-31';
  else
    v_from := make_date(v_year, 1, 1);
    v_to := case when v_year = v_current then v_today else make_date(v_year, 12, 31) end;
    v_forecast_to := make_date(v_year, 12, 31);
  end if;

  v_parts := private.dashboard_components(v_from, v_to);
  v_forecast := private.dashboard_components(v_from, v_forecast_to);
  v_revenue := (v_parts->>'revenue')::numeric;
  v_expense := (v_parts->>'total')::numeric;
  v_gross := (v_parts->>'gross')::numeric;
  v_net := (v_parts->>'net')::numeric;
  v_project := (v_parts->>'project_expense')::numeric;
  v_admin := (v_parts->>'admin_expense')::numeric;

  if v_year is null then
    v_prior := null;
  else
    if v_year = v_current then
      v_prior_from := make_date(v_year - 1, 1, 1);
      v_prior_to := (v_today - interval '1 year')::date;
    else
      v_prior_from := make_date(v_year - 1, 1, 1);
      v_prior_to := make_date(v_year - 1, 12, 31);
    end if;
    v_prior := private.dashboard_components(v_prior_from, v_prior_to);
  end if;

  if v_year is null then
    select coalesce(sum(ci.amount), 0)
    into v_billed
    from public.client_invoices ci
    join public.projects p on p.id = ci.project_id
    join public.clients c on c.id = ci.client_id
    where ci.status is distinct from 'void';

    select coalesce(sum(cp.amount), 0)
    into v_paid
    from public.client_payments cp
    join public.client_invoices ci on ci.id = cp.client_invoice_id
    join public.projects p on p.id = ci.project_id
    join public.clients c on c.id = ci.client_id
    where ci.status is distinct from 'void';
  else
    select coalesce(sum(ci.amount), 0)
    into v_billed
    from public.client_invoices ci
    join public.projects p on p.id = ci.project_id
    join public.clients c on c.id = ci.client_id
    where ci.status is distinct from 'void'
      and ci.issued_on between v_from and v_to;

    select coalesce(sum(cp.amount), 0)
    into v_paid
    from public.client_payments cp
    join public.client_invoices ci on ci.id = cp.client_invoice_id
    join public.projects p on p.id = ci.project_id
    join public.clients c on c.id = ci.client_id
    where ci.status is distinct from 'void'
      and cp.paid_on between v_from and v_to;
  end if;

  if v_year is null or v_year = v_current then
    v_receivables := private.report_ar_open(v_today);

    v_payables := private.report_ap_open(v_today);
  else
    v_receivables := private.report_ar_open(v_to);

    v_payables := private.report_ap_open(v_to);
  end if;

  v_cash := private.dashboard_cash(v_to);
  v_prev_month := (date_trunc('month', v_to)::date - 1);
  v_prev_cash := private.dashboard_cash(v_prev_month);

  select coalesce(min(case
    when year between 1990 and 2200 then year
    when started_on is not null then extract(year from started_on)::integer
    else null
  end), v_current)
  into v_first
  from public.projects;

  if v_first > 2021 then
    v_first := 2021;
  end if;

  for v_cursor in reverse v_current..2021 loop
    v_years := v_years || to_jsonb(v_cursor);
  end loop;

  if v_year is null then
    for v_cursor in v_first..v_current loop
      v_slice := private.dashboard_components(
        make_date(v_cursor, 1, 1),
        case when v_cursor = v_current then v_today else make_date(v_cursor, 12, 31) end
      );
      v_label := v_cursor::text;
      v_sparks := v_sparks || jsonb_build_array(jsonb_build_object('label', v_label, 'value', (v_slice->>'revenue')::numeric));
      v_gross_spark := v_gross_spark || jsonb_build_array(jsonb_build_object('label', v_label, 'value', (v_slice->>'gross')::numeric));
      v_net_spark := v_net_spark || jsonb_build_array(jsonb_build_object('label', v_label, 'value', (v_slice->>'net')::numeric));
      v_expense_spark := v_expense_spark || jsonb_build_array(jsonb_build_object('label', v_label, 'value', (v_slice->>'total')::numeric));
      v_cash_spark := v_cash_spark || jsonb_build_array(jsonb_build_object(
        'label', v_label,
        'value', private.dashboard_cash(case when v_cursor = v_current then v_today else make_date(v_cursor, 12, 31) end)
      ));
      v_annual := v_annual || jsonb_build_array(jsonb_build_object(
        'label', 'FY' || v_cursor::text,
        'gross_profit', (v_slice->>'gross')::numeric
      ));
      select count(*) into v_projects
      from public.projects p
      where (p.year between 1990 and 2200 and p.year = v_cursor)
        or (p.year is null and extract(year from p.started_on)::integer = v_cursor);
      v_trend := v_trend || jsonb_build_array(jsonb_build_object('label', v_label, 'count', v_projects));
    end loop;
  else
    v_last_month := extract(month from v_to)::integer;
    for v_month in 1..v_last_month loop
      v_month_start := make_date(v_year, v_month, 1);
      v_month_end := (v_month_start + interval '1 month' - interval '1 day')::date;
      if v_month_end > v_to then
        v_month_end := v_to;
      end if;
      v_slice := private.dashboard_components(v_month_start, v_month_end);
      v_label := to_char(v_month_start, 'Mon');
      v_sparks := v_sparks || jsonb_build_array(jsonb_build_object('label', v_label, 'value', (v_slice->>'revenue')::numeric));
      v_gross_spark := v_gross_spark || jsonb_build_array(jsonb_build_object('label', v_label, 'value', (v_slice->>'gross')::numeric));
      v_net_spark := v_net_spark || jsonb_build_array(jsonb_build_object('label', v_label, 'value', (v_slice->>'net')::numeric));
      v_expense_spark := v_expense_spark || jsonb_build_array(jsonb_build_object('label', v_label, 'value', (v_slice->>'total')::numeric));
      v_cash_spark := v_cash_spark || jsonb_build_array(jsonb_build_object(
        'label', v_label,
        'value', private.dashboard_cash(v_month_end)
      ));
      v_annual := v_annual || jsonb_build_array(jsonb_build_object('label', v_label, 'gross_profit', (v_slice->>'gross')::numeric));
      select count(*) into v_projects
      from public.projects p
      where p.started_on between v_month_start and v_month_end
        and (
          (p.year between 1990 and 2200 and p.year = v_year)
          or (p.year is null and extract(year from p.started_on)::integer = v_year)
          or p.year = v_year
        );
      v_trend := v_trend || jsonb_build_array(jsonb_build_object('label', v_label, 'count', v_projects));
    end loop;
  end if;

  v_week_start := date_trunc('week', v_to)::date;
  v_week_end := v_week_start + 6;
  for v_offset in reverse 11..0 loop
    v_month_start := v_week_start - (v_offset * 7);
    v_month_end := v_month_start + 6;
    v_slice := private.dashboard_components(
      greatest(v_month_start, v_from),
      least(v_month_end, v_to)
    );
    v_weeks := v_weeks || jsonb_build_array(jsonb_build_object(
      'label', 'W' || extract(week from v_month_start)::integer::text,
      'revenue', (v_slice->>'revenue')::numeric,
      'project_expense', (v_slice->>'project_expense')::numeric,
      'admin_expense', (v_slice->>'admin_expense')::numeric,
      'total_expense', (v_slice->>'total')::numeric,
      'net_profit', (v_slice->>'net')::numeric
    ));
  end loop;

  if v_year is null then
    select
      count(*),
      count(*) filter (where p.total_value >= 50000),
      count(*) filter (where p.total_value < 50000),
      count(*) filter (where p.status = 'active'),
      coalesce(sum(p.total_value), 0),
      min(case
        when p.year between 1990 and 2200 then p.year
        else extract(year from p.started_on)::integer
      end)
    into v_projects, v_high, v_low, v_active, v_contract, v_since
    from public.projects p;

    select
      count(*) filter (where coalesce(s.is_open, false)),
      coalesce(sum(l.estimated_value) filter (where coalesce(s.is_open, false)), 0),
      count(*) filter (where l.status = 'won'),
      count(*) filter (where l.status = 'lost')
    into v_open_leads, v_lead_value, v_won, v_lost
    from public.leads l
    left join public.lead_statuses s on s.code = l.status;

    select count(*) into v_clients from public.clients;
    select count(*) into v_backlog from public.project_backlogs;
    select count(*) into v_cursor from public.projects;
  else
    select
      count(*),
      count(*) filter (where p.total_value >= 50000),
      count(*) filter (where p.total_value < 50000),
      count(*) filter (where p.status = 'active'),
      coalesce(sum(p.total_value), 0)
    into v_projects, v_high, v_low, v_active, v_contract
    from public.projects p
    where (p.year between 1990 and 2200 and p.year = v_year)
      or ((p.year is null or p.year not between 1990 and 2200) and extract(year from p.started_on)::integer = v_year);

    v_since := case when v_projects > 0 then v_year else null end;

    select
      count(*) filter (where coalesce(s.is_open, false)),
      coalesce(sum(l.estimated_value) filter (where coalesce(s.is_open, false)), 0),
      count(*) filter (where l.status = 'won'),
      count(*) filter (where l.status = 'lost')
    into v_open_leads, v_lead_value, v_won, v_lost
    from public.leads l
    left join public.lead_statuses s on s.code = l.status
    where l.added_on between v_from and v_to;

    select count(*)
    into v_clients
    from public.clients
    where (created_at at time zone 'Asia/Dhaka')::date between v_from and v_to;

    select count(*)
    into v_backlog
    from public.project_backlogs b
    join public.projects p on p.id = b.project_id
    where (p.year between 1990 and 2200 and p.year = v_year)
      or ((p.year is null or p.year not between 1990 and 2200) and extract(year from p.started_on)::integer = v_year);

    v_cursor := v_projects;
  end if;

  select coalesce(launch_date, date '2021-01-01')
  into v_launch
  from public.company_settings
  where id is true;

  if v_year is null then
    v_span_start := case when v_launch <= v_today then v_launch else v_today end;
    v_span_end := v_today;
  else
    v_span_start := case when v_launch > v_from then v_launch else v_from end;
    v_span_end := v_to;
  end if;

  if v_span_start <= v_span_end then
    v_days := greatest((v_span_end - v_span_start), 1);
  else
    v_days := 0;
  end if;

  return jsonb_build_object(
    'scope_year', v_year,
    'current_year', v_current,
    'years', v_years,
    'annual_first', case when v_year is null then v_first else v_year end,
    'annual_last', case when v_year is null then v_current else v_year end,
    'annual_monthly', v_year is not null,
    'trend_total', v_cursor,
    'cash_balance', v_cash,
    'cash_delta', private.dashboard_delta(v_cash, v_prev_cash),
    'cash_spark', v_cash_spark,
    'receivables', v_receivables,
    'payables', v_payables,
    'forecasted_profit', (v_forecast->>'net')::numeric + v_receivables - v_payables,
    'weeks', v_weeks,
    'week', jsonb_build_object(
      'start', v_week_start,
      'end', v_week_end,
      'number', extract(week from v_week_start)::integer
    ),
    'annual', v_annual,
    'trend', v_trend,
    'performance', jsonb_build_object(
      'project_count', v_projects,
      'since_year', v_since,
      'high_value', v_high,
      'low_value', v_low,
      'active', v_active,
      'open_leads', v_open_leads,
      'clients', v_clients,
      'lead_value', v_lead_value,
      'win_rate', private.dashboard_ratio(v_won, v_won + v_lost),
      'collection_efficiency', private.dashboard_ratio((
        select coalesce(sum(cp.amount), 0)
        from public.client_payments cp
        join public.client_invoices ci on ci.id = cp.client_invoice_id
        join public.projects p on p.id = ci.project_id
        where ci.status is distinct from 'void'
          and (v_year is null
            or (p.year between 1990 and 2200 and p.year = v_year)
            or ((p.year is null or p.year not between 1990 and 2200) and extract(year from p.started_on)::integer = v_year))
      ), v_contract),
      'backlog', v_backlog
    ),
    'tenure', jsonb_build_object(
      'launch', v_launch,
      'span_start', v_span_start,
      'span_end', v_span_end,
      'revenue_per_day', case when v_days = 0 then 0 else round(v_revenue / v_days) end,
      'net_profit_per_day', case when v_days = 0 then 0 else round(v_net / v_days) end
    ),
    'snapshot', jsonb_build_object(
      'year', coalesce(v_year, v_current),
      'revenue', v_revenue,
      'revenue_delta', case when v_prior is null then null else private.dashboard_delta(v_revenue, (v_prior->>'revenue')::numeric) end,
      'gross_profit', v_gross,
      'gross_delta', case when v_prior is null then null else private.dashboard_delta(v_gross, (v_prior->>'gross')::numeric) end,
      'net_profit', v_net,
      'net_delta', case when v_prior is null then null else private.dashboard_delta(v_net, (v_prior->>'net')::numeric) end,
      'total_expense', v_expense,
      'expense_delta', case when v_prior is null then null else private.dashboard_delta(v_expense, (v_prior->>'total')::numeric) end,
      'withdrawal', (v_parts->>'withdrawal')::numeric,
      'material', (v_parts->>'material')::numeric,
      'subcontractor', (v_parts->>'subcontractor')::numeric,
      'project_overhead', (v_parts->>'project_overhead')::numeric,
      'tax', (v_parts->>'tax')::numeric,
      'admin', (v_parts->>'admin')::numeric,
      'operational', (v_parts->>'operational')::numeric,
      'marketing', (v_parts->>'marketing')::numeric,
      'salary', (v_parts->>'salary')::numeric,
      'project_expense', v_project,
      'collection_rate', private.dashboard_ratio(v_paid, v_billed),
      'expense_ratio', private.dashboard_ratio(v_expense, v_revenue),
      'gross_margin', private.dashboard_ratio(v_gross, v_revenue),
      'net_margin', private.dashboard_ratio(v_net, v_revenue),
      'withdrawal_ratio', private.dashboard_ratio((v_parts->>'withdrawal')::numeric, v_revenue),
      'project_cost_ratio', private.dashboard_ratio(v_project, v_expense),
      'tax_ratio', private.dashboard_ratio((v_parts->>'tax')::numeric, v_revenue),
      'admin_ratio', private.dashboard_ratio(v_admin, v_revenue),
      'revenue_spark', v_sparks,
      'gross_spark', v_gross_spark,
      'net_spark', v_net_spark,
      'expense_spark', v_expense_spark
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.dashboard_feed()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    'receivables', private.report_ar_open((timezone('Asia/Dhaka', now()))::date),
    'payables', private.report_ap_open((timezone('Asia/Dhaka', now()))::date),
    'backlog_count', (select count(*) from public.project_backlogs),
    'launch_date', (
      select launch_date from public.company_settings where id is true
    )
  )
  into result;

  return result;
end;
$function$;
