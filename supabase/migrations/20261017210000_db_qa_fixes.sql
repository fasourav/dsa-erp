-- DB QA fixes from the 2026-10-15 read-only audit.
-- Not applied by the app. Apply it with the normal migration flow.
-- Leaked password protection (DB-M01) is intentionally unchanged.

-- DB-H01. Verify-hit rows stay private. No policies: only the owner and
-- security definer writers (verify and purge) can touch the table.
alter table private.document_verify_hits enable row level security;

revoke all on table private.document_verify_hits from public, anon, authenticated, service_role;

comment on table private.document_verify_hits is
  'QR verify rate-limit hits. RLS is on and there are no policies. anon, authenticated, and service_role have no grants. Only the table owner and security definer functions may read or write.';

-- DB-M02. Public QR verify stays executable by anon. Accepted on purpose.
comment on function public.verify_business_document(text) is
  'Accepted public QR surface (DB-M02). anon and authenticated may execute this security definer function. It returns document number, date, total, and status only, and it rate-limits through private.document_verify_hits, which anon cannot read or write.';

-- DB-H02. Payables follow non-void bills, matching the accounts payable page
-- and private.report_ap_open. Unbilled order value is a commitment, not a payable.
-- Open is the sum of each bill's unpaid balance, so an overpayment on one bill
-- does not cover another. accounts_payable_aging and ap_aging_summary read this
-- view, so they pick up the same figures without a separate definition.
create or replace view public.accounts_payable
with (security_invoker = true) as
with bill_paid as (
  select
    vi.id,
    vi.purchase_order_id,
    vi.amount,
    vi.due_on,
    coalesce(sum(vp.amount), 0) as paid
  from public.vendor_invoices vi
  left join public.vendor_payments vp on vp.vendor_invoice_id = vi.id
  where vi.status is distinct from 'void'::public.payment_status
    and vi.purchase_order_id is not null
  group by vi.id
),
po_billed as (
  select
    bill_paid.purchase_order_id,
    coalesce(sum(bill_paid.amount), 0)::numeric(14, 2) as total_payable,
    coalesce(sum(bill_paid.paid), 0)::numeric(14, 2) as total_paid,
    coalesce(sum(greatest(bill_paid.amount - bill_paid.paid, 0)), 0)::numeric(14, 2) as pending_payable,
    min(bill_paid.due_on) filter (
      where bill_paid.due_on is not null
        and bill_paid.paid < bill_paid.amount
    ) as due_date
  from bill_paid
  group by bill_paid.purchase_order_id
)
select
  po.id,
  billed.due_date,
  case
    when billed.total_payable > 0 and billed.pending_payable <= 0 then 'paid'::public.payment_status
    when billed.total_paid > 0 then 'partial'::public.payment_status
    else 'unpaid'::public.payment_status
  end as current_status,
  po.id as purchase_order_id,
  po.project_id,
  case
    when po.project_id is null then 'Operational'
    else p.name
  end as project_name,
  v.id as vendor_id,
  coalesce(v.person_name, v.company_name) as vendor_name,
  (case when private.sees_money() then billed.total_payable end)::numeric(14, 2) as total_payable,
  (case when private.sees_money() then billed.total_paid end)::numeric(14, 2) as total_paid,
  (case when private.sees_money() then billed.pending_payable end)::numeric(14, 2) as pending_payable,
  po.issued_on,
  po.created_at,
  v.vendor_field,
  po.work_type
from public.vendor_purchase_orders po
join public.vendors v on v.id = po.vendor_id
left join public.projects p on p.id = po.project_id
join po_billed billed on billed.purchase_order_id = po.id
where private.can('accounts_payable', 'view');

alter view public.accounts_payable set (security_invoker = true);

comment on view public.accounts_payable is
  'One row per purchase order that has a non-void bill. Billed, paid, and open follow those bills. Void bills are excluded. Orders with no live bill are omitted.';

-- DB-H03. Queue claim and settle are cron/service work. Signed-in users must
-- not race or clear the queue. The app drain uses the service role client.
revoke all on function public.claim_attachment_file_purges(integer) from public, anon, authenticated;
revoke all on function public.settle_attachment_file_purges(text[]) from public, anon, authenticated;

grant execute on function public.claim_attachment_file_purges(integer) to service_role;
grant execute on function public.settle_attachment_file_purges(text[]) to service_role;

-- DB-H04. These views were security definer so they could read columns
-- authenticated is not granted (salary, allowance, opening balance, amount)
-- and so dashboard or project-budget readers were not cut off by narrower
-- table policies. The views are now security invoker. The row filters and
-- money masks stay inside security definer functions, which keep those
-- column grants and policies unchanged.

-- Salary, allowance, opening balance, and the uncast transaction amount are
-- plain numeric on the existing views. CASE dropped numeric(14,2). Replace
-- cannot change a view column type, so these functions keep plain numeric.
create or replace function private.employees_readable_rows()
returns table (
  id uuid,
  full_name text,
  department_id uuid,
  department text,
  designation text,
  monthly_salary numeric,
  allowance numeric,
  email text,
  phone text,
  joining_date date,
  leave_date date,
  is_active boolean,
  notes text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
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
$$;

revoke all on function private.employees_readable_rows() from public, anon;
grant execute on function private.employees_readable_rows() to authenticated, service_role;

create or replace view public.employees_readable
with (security_invoker = true) as
select
  id,
  full_name,
  department_id,
  department,
  designation,
  monthly_salary,
  allowance,
  email,
  phone,
  joining_date,
  leave_date,
  is_active,
  notes,
  created_at,
  updated_at
from private.employees_readable_rows();

alter view public.employees_readable set (security_invoker = true);

create or replace function private.bank_accounts_readable_rows()
returns table (
  id uuid,
  name text,
  account_holder_name text,
  account_number text,
  bank_name text,
  routing_number text,
  address text,
  opening_balance numeric,
  currency text,
  is_active boolean,
  sort_order integer,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
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
$$;

revoke all on function private.bank_accounts_readable_rows() from public, anon;
grant execute on function private.bank_accounts_readable_rows() to authenticated, service_role;

create or replace view public.bank_accounts_readable
with (security_invoker = true) as
select
  id,
  name,
  account_holder_name,
  account_number,
  bank_name,
  routing_number,
  address,
  opening_balance,
  currency,
  is_active,
  sort_order,
  created_at
from private.bank_accounts_readable_rows();

alter view public.bank_accounts_readable set (security_invoker = true);

create or replace function private.bank_transactions_readable_rows()
returns table (
  id uuid,
  bank_account_id uuid,
  transaction_date date,
  created_at timestamptz,
  direction public.bank_flow_direction,
  amount numeric,
  source_kind public.bank_source_kind,
  payment_method text,
  project_id uuid,
  notes text,
  income_id uuid,
  vendor_payment_id uuid,
  operational_expense_id uuid,
  vat_tax_payment_id uuid,
  payroll_line_id uuid,
  transfer_id uuid
)
language sql
stable
security definer
set search_path = ''
as $$
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
$$;

revoke all on function private.bank_transactions_readable_rows() from public, anon;
grant execute on function private.bank_transactions_readable_rows() to authenticated, service_role;

create or replace view public.bank_transactions_readable
with (security_invoker = true) as
select
  id,
  bank_account_id,
  transaction_date,
  created_at,
  direction,
  amount,
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
from private.bank_transactions_readable_rows();

alter view public.bank_transactions_readable set (security_invoker = true);

create or replace function private.bank_transaction_detail_rows()
returns table (
  id uuid,
  direction public.bank_flow_direction,
  source_kind public.bank_source_kind,
  transaction_date date,
  amount numeric(14, 2),
  payment_method text,
  income_id uuid,
  vendor_payment_id uuid,
  operational_expense_id uuid,
  vat_tax_payment_id uuid,
  project_id uuid,
  project_name text,
  bank_account_name text,
  notes text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
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
$$;

revoke all on function private.bank_transaction_detail_rows() from public, anon;
grant execute on function private.bank_transaction_detail_rows() to authenticated, service_role;

create or replace view public.bank_transaction_details
with (security_invoker = true) as
select
  id,
  direction,
  source_kind,
  transaction_date,
  amount,
  payment_method,
  income_id,
  vendor_payment_id,
  operational_expense_id,
  vat_tax_payment_id,
  project_id,
  project_name,
  bank_account_name,
  notes,
  created_at
from private.bank_transaction_detail_rows();

alter view public.bank_transaction_details set (security_invoker = true);

-- DB-M05. Paid and pending ignore void bills. Pending is still order value
-- minus that paid sum. The outer purchase-order permission check is unchanged.
create or replace function private.vendor_po_balance_rows()
returns table (
  purchase_order_id uuid,
  project_id uuid,
  vendor_id uuid,
  total_value numeric(14, 2),
  total_paid numeric(14, 2),
  total_pending numeric(14, 2)
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.purchase_order_id,
    s.project_id,
    s.vendor_id,
    (case when private.sees_money() then s.total_value end)::numeric(14, 2) as total_value,
    (case when private.sees_money() then s.total_paid end)::numeric(14, 2) as total_paid,
    (case when private.sees_money() then s.total_pending end)::numeric(14, 2) as total_pending
  from (
    select
      po.id as purchase_order_id,
      po.project_id,
      po.vendor_id,
      po.total_value,
      (case
        when private.can('vendor_payments', 'view') and private.sees_financials()
          then coalesce(sum(vp.amount), 0)
        else null
      end)::numeric(14, 2) as total_paid,
      (case
        when private.can('vendor_payments', 'view') and private.sees_financials()
          then greatest(po.total_value - coalesce(sum(vp.amount), 0), 0)
        else null
      end)::numeric(14, 2) as total_pending
    from public.vendor_purchase_orders po
    left join public.vendor_invoices vi
      on vi.purchase_order_id = po.id
     and vi.status is distinct from 'void'::public.payment_status
    left join public.vendor_payments vp on vp.vendor_invoice_id = vi.id
    where private.can('purchase_orders', 'view')
       or private.can('vendor_payments', 'view')
       or private.can('accounts_payable', 'view')
       or private.can('expense', 'view')
       or private.can('dashboard', 'view')
    group by po.id
  ) s
  where private.can('purchase_orders', 'view');
$$;

revoke all on function private.vendor_po_balance_rows() from public, anon;
grant execute on function private.vendor_po_balance_rows() to authenticated, service_role;

create or replace view public.vendor_po_balances
with (security_invoker = true) as
select
  purchase_order_id,
  project_id,
  vendor_id,
  total_value,
  total_paid,
  total_pending
from private.vendor_po_balance_rows();

alter view public.vendor_po_balances set (security_invoker = true);

create or replace function private.project_budget_actual_visible()
returns table (
  project_id uuid,
  project_name text,
  category_id uuid,
  category_name text,
  actual_amount numeric(14, 2),
  committed_amount numeric(14, 2)
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    rows.project_id,
    p.name as project_name,
    rows.category_id,
    rows.category_name,
    (case when private.sees_money() then rows.actual_amount end)::numeric(14, 2) as actual_amount,
    (case when private.sees_money() then rows.committed_amount end)::numeric(14, 2) as committed_amount
  from private.project_budget_actual_rows() rows
  join public.projects p on p.id = rows.project_id
  where private.can('projects', 'view')
     or private.can('project_budgets', 'view');
$$;

revoke all on function private.project_budget_actual_visible() from public, anon;
grant execute on function private.project_budget_actual_visible() to authenticated, service_role;

create or replace view public.project_budget_actual
with (security_invoker = true) as
select
  project_id,
  project_name,
  category_id,
  category_name,
  actual_amount,
  committed_amount
from private.project_budget_actual_visible();

alter view public.project_budget_actual set (security_invoker = true);

comment on view public.project_budget_actual is
  'Actual and committed spend by project and category. Actual sums vendor bills and project-tagged operational expenses. Anyone who can view projects or project budgets can read it. The view is security invoker; the row query stays in private.project_budget_actual_visible().';

-- DB-M06. RLS does not apply to TRUNCATE. Direct SQL as authenticated should
-- not be able to empty money tables. Select, insert, update, and delete stay.
revoke truncate on all tables in schema public from authenticated;

-- DB-M07. Zero policies are the lock, not a missing grant.
comment on table private.attachment_file_purges is
  'Intentional lockout. RLS is enabled, there are no policies, and table grants are revoked from anon, authenticated, and service_role. Only security definer functions may queue, claim, or settle paths.';

-- DB-M08. Foreign keys the new progress and budget tables did not index.
create index if not exists project_budget_lines_category_id_idx
  on public.project_budget_lines (category_id);

create index if not exists project_milestones_stage_id_idx
  on public.project_milestones (stage_id)
  where stage_id is not null;

create index if not exists project_milestones_work_order_milestone_id_idx
  on public.project_milestones (work_order_milestone_id)
  where work_order_milestone_id is not null;

-- DB-L02. One stage name per project, ignoring case and surrounding spaces.
-- Stops if duplicates already exist so a later apply cannot hide them.
do $$
begin
  if exists (
    select 1
    from public.project_stages
    group by project_id, lower(btrim(name))
    having count(*) > 1
  ) then
    raise exception 'project stage names are not unique within a project; resolve duplicates before adding project_stages_project_name_ci';
  end if;
end $$;

create unique index if not exists project_stages_project_name_ci
  on public.project_stages (project_id, lower(btrim(name)));

-- Not changed in this file:
-- DB-M01 leaked password protection (dashboard setting; left off on purpose).
-- DB-L01 unused indexes (kept).
-- DB-L04 permission keys expense and expenses are two live modules
--   (Expense and Operational Expense). They are not merged.
-- DB-M03 record_backup stays owner-gated inside the function.
-- DB-M04 and DB-M09 migration name drift is documentation only.
--   projects.recovery_plan is already in the generated types.

notify pgrst, 'reload schema';
