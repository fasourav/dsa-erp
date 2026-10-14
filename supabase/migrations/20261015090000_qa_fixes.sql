-- QA fixes 2026-10-15. Files only; apply with the normal migration flow.
-- 1) Amount floors on invoice / bill / PO edits, 2) accrual reports and a
-- balancing balance sheet, 3) vendor paid/due masking, 4) project gross profit
-- includes tax, 5) amount caps, date rules and text length limits, 6) aging
-- days stop at today, 7) activity_log created_at index.

-- Indian-grouped taka text for error messages, e.g. 1234567.5 -> '12,34,567.50'.
create or replace function private.format_bdt(p_amount numeric)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_abs numeric := abs(round(coalesce(p_amount, 0), 2));
  v_int text := trunc(v_abs)::text;
  v_frac text := lpad(((v_abs - trunc(v_abs)) * 100)::int::text, 2, '0');
  v_out text;
begin
  if length(v_int) <= 3 then
    v_out := v_int;
  else
    v_out := right(v_int, 3);
    v_int := left(v_int, length(v_int) - 3);
    while length(v_int) > 2 loop
      v_out := right(v_int, 2) || ',' || v_out;
      v_int := left(v_int, length(v_int) - 2);
    end loop;
    v_out := v_int || ',' || v_out;
  end if;
  return case when p_amount < 0 then '-' else '' end || '৳' || v_out || '.' || v_frac;
end;
$$;
revoke all on function private.format_bdt(numeric) from public, anon, authenticated;

-- 1) Floors: an invoice, bill or PO value can't drop below what is already paid
-- (or, for a PO, already billed).
create or replace function private.guard_client_invoice_floor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paid numeric;
begin
  if new.amount >= old.amount then
    return new;
  end if;
  select coalesce(sum(p.amount), 0) into v_paid
  from public.client_payments p
  where p.client_invoice_id = new.id;
  if round(new.amount, 2) < round(v_paid, 2) then
    raise exception 'Amount can''t be less than % already paid.', private.format_bdt(v_paid)
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function private.guard_vendor_invoice_floor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paid numeric;
begin
  if new.amount >= old.amount then
    return new;
  end if;
  select coalesce(sum(p.amount), 0) into v_paid
  from public.vendor_payments p
  where p.vendor_invoice_id = new.id;
  if round(new.amount, 2) < round(v_paid, 2) then
    raise exception 'Amount can''t be less than % already paid.', private.format_bdt(v_paid)
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function private.guard_purchase_order_floor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_billed numeric;
  v_paid numeric;
begin
  if coalesce(new.total_value, 0) >= coalesce(old.total_value, 0) then
    return new;
  end if;
  select coalesce(sum(vi.amount), 0) into v_billed
  from public.vendor_invoices vi
  where vi.purchase_order_id = new.id
    and vi.status is distinct from 'void';
  select coalesce(sum(vp.amount), 0) into v_paid
  from public.vendor_invoices vi
  join public.vendor_payments vp on vp.vendor_invoice_id = vi.id
  where vi.purchase_order_id = new.id;
  if round(coalesce(new.total_value, 0), 2) < round(v_paid, 2) then
    raise exception 'Amount can''t be less than % already paid.', private.format_bdt(v_paid)
      using errcode = '23514';
  end if;
  if round(coalesce(new.total_value, 0), 2) < round(v_billed, 2) then
    raise exception 'Amount can''t be less than % already invoiced.', private.format_bdt(v_billed)
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists client_invoices_amount_floor on public.client_invoices;
create trigger client_invoices_amount_floor
  before update of amount on public.client_invoices
  for each row execute function private.guard_client_invoice_floor();
drop trigger if exists vendor_invoices_amount_floor on public.vendor_invoices;
create trigger vendor_invoices_amount_floor
  before update of amount on public.vendor_invoices
  for each row execute function private.guard_vendor_invoice_floor();
drop trigger if exists vendor_purchase_orders_value_floor on public.vendor_purchase_orders;
create trigger vendor_purchase_orders_value_floor
  before update of total_value on public.vendor_purchase_orders
  for each row execute function private.guard_purchase_order_floor();

-- 5a) Payment dates can't be in the future (Asia/Dhaka).
create or replace function private.guard_payment_not_future()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.paid_on is not null and new.paid_on > (timezone('Asia/Dhaka', now()))::date then
    raise exception 'Payment date can''t be in the future.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists client_payments_date_not_future on public.client_payments;
create trigger client_payments_date_not_future
  before insert or update of paid_on on public.client_payments
  for each row execute function private.guard_payment_not_future();
drop trigger if exists vendor_payments_date_not_future on public.vendor_payments;
create trigger vendor_payments_date_not_future
  before insert or update of paid_on on public.vendor_payments
  for each row execute function private.guard_payment_not_future();
drop trigger if exists vat_tax_payments_date_not_future on public.vat_tax_payments;
create trigger vat_tax_payments_date_not_future
  before insert or update of paid_on on public.vat_tax_payments
  for each row execute function private.guard_payment_not_future();

-- 5b) Due date on or after the issue date. NOT VALID: enforced for new and
-- edited rows without failing on any legacy row.
alter table public.client_invoices
  add constraint client_invoices_due_after_issue
  check (due_on is null or issued_on is null or due_on >= issued_on) not valid;
alter table public.vendor_invoices
  add constraint vendor_invoices_due_after_issue
  check (due_on is null or issued_on is null or due_on >= issued_on) not valid;

-- 5c) Money cap ৳99,99,99,999.99 and text length limits (names 120, notes 1000).
do $$
declare
  c record;
begin
  for c in
    select * from (values
      ('projects', 'total_value'),
      ('client_invoices', 'amount'),
      ('client_payments', 'amount'),
      ('vendor_purchase_orders', 'total_value'),
      ('vendor_invoices', 'amount'),
      ('vendor_payments', 'amount'),
      ('operational_expenses', 'amount'),
      ('vat_tax_payments', 'amount'),
      ('bank_transfers', 'amount'),
      ('bank_transactions', 'amount'),
      ('bank_accounts', 'opening_balance'),
      ('leads', 'estimated_value'),
      ('employees', 'monthly_salary'),
      ('employees', 'allowance'),
      ('assets', 'unit_cost'),
      ('assets', 'total_cost'),
      ('budgets', 'allocated_budget')
    ) as t(tbl, col)
  loop
    execute format(
      'alter table public.%I add constraint %I check (%I is null or %I <= 999999999.99) not valid',
      c.tbl, c.tbl || '_' || c.col || '_cap', c.col, c.col
    );
  end loop;

  for c in
    select * from (values
      ('leads', 'lead_name'),
      ('clients', 'person_name'),
      ('clients', 'company_name'),
      ('vendors', 'person_name'),
      ('vendors', 'company_name'),
      ('projects', 'name'),
      ('employees', 'full_name'),
      ('assets', 'name'),
      ('bank_accounts', 'name')
    ) as t(tbl, col)
  loop
    execute format(
      'alter table public.%I add constraint %I check (char_length(%I) <= 120) not valid',
      c.tbl, c.tbl || '_' || c.col || '_len', c.col
    );
  end loop;

  for c in
    select cl.table_name as tbl
    from information_schema.columns cl
    join information_schema.tables t
      on t.table_schema = cl.table_schema and t.table_name = cl.table_name
    where cl.table_schema = 'public'
      and cl.column_name = 'notes'
      and t.table_type = 'BASE TABLE'
      and cl.data_type = 'text'
  loop
    execute format(
      'alter table public.%I add constraint %I check (char_length(notes) <= 1000) not valid',
      c.tbl, c.tbl || '_notes_len'
    );
  end loop;
end
$$;

-- 3) Paid and due figures only for people who can see vendor payments and
-- have Show Financials on. Column list and types are unchanged.
create or replace view public.vendor_po_balances
with (security_invoker = false) as
 select po.id as purchase_order_id,
    po.project_id,
    po.vendor_id,
    po.total_value,
    (case when private.can('vendor_payments', 'view') and private.sees_financials()
      then coalesce(sum(vp.amount), 0) end)::numeric(14,2) as total_paid,
    (case when private.can('vendor_payments', 'view') and private.sees_financials()
      then greatest(po.total_value - coalesce(sum(vp.amount), 0), 0) end)::numeric(14,2) as total_pending
   from vendor_purchase_orders po
     left join vendor_invoices vi on vi.purchase_order_id = po.id
     left join vendor_payments vp on vp.vendor_invoice_id = vi.id
  where private.can('purchase_orders', 'view') or private.can('vendor_payments', 'view')
     or private.can('accounts_payable', 'view') or private.can('expense', 'view')
     or private.can('dashboard', 'view')
  group by po.id;

create or replace view public.vendor_summaries
with (security_invoker = true) as
 select v.id as vendor_id,
    v.kind,
    coalesce(v.person_name, v.company_name) as display_name,
    v.vendor_field,
    coalesce(sum(b.total_value), 0)::numeric(14,2) as total_po_value,
    (case when private.can('vendor_payments', 'view') and private.sees_financials()
      then coalesce(sum(b.total_paid), 0) end)::numeric(14,2) as total_paid,
    (case when private.can('vendor_payments', 'view') and private.sees_financials()
      then coalesce(sum(b.total_pending), 0) end)::numeric(14,2) as total_due
   from vendors v
     left join vendor_po_balances b on b.vendor_id = v.id
  group by v.id;

-- 4) Project gross profit = collected - project expense - VAT/tax, like the dashboard.
create or replace view public.project_financials
with (security_invoker = true) as
 with client_paid as (
         select ci.project_id,
            coalesce(sum(cp_1.amount), 0)::numeric(14,2) as total_paid
           from client_invoices ci
             left join client_payments cp_1 on cp_1.client_invoice_id = ci.id
          where ci.status <> 'void'::payment_status
          group by ci.project_id
        ), po_committed as (
         select vendor_purchase_orders.project_id,
            coalesce(sum(vendor_purchase_orders.total_value), 0)::numeric(14,2) as committed_total
           from vendor_purchase_orders
          group by vendor_purchase_orders.project_id
        ), vendor_expense_paid as (
         select po.project_id,
            coalesce(sum(vp.amount), 0)::numeric(14,2) as paid_total
           from vendor_purchase_orders po
             left join vendor_invoices vi on vi.purchase_order_id = po.id
             left join vendor_payments vp on vp.vendor_invoice_id = vi.id
          group by po.project_id
        ), operational_expense_paid as (
         select operational_expenses.project_id,
            coalesce(sum(operational_expenses.amount), 0)::numeric(14,2) as paid_total
           from operational_expenses
          where operational_expenses.project_id is not null
          group by operational_expenses.project_id
        ), tax_paid as (
         select vat_tax_payments.project_id,
            coalesce(sum(vat_tax_payments.amount), 0)::numeric(14,2) as paid_total
           from vat_tax_payments
          group by vat_tax_payments.project_id
        )
 select p.id as project_id,
    p.name as project_name,
    p.client_id,
    p.total_value,
    coalesce(cp.total_paid, 0)::numeric(14,2) as total_paid,
    greatest(p.total_value - coalesce(cp.total_paid, 0), 0)::numeric(14,2) as total_pending_due,
    (coalesce(vep.paid_total, 0) + coalesce(oep.paid_total, 0))::numeric(14,2) as expense_total,
    greatest(coalesce(poc.committed_total, 0) - coalesce(vep.paid_total, 0), 0)::numeric(14,2) as expense_due,
    (coalesce(cp.total_paid, 0) - (coalesce(vep.paid_total, 0) + coalesce(oep.paid_total, 0)) - coalesce(tp.paid_total, 0))::numeric(14,2) as gross_profit,
    (case
        when (coalesce(vep.paid_total, 0) + coalesce(oep.paid_total, 0)) > coalesce(cp.total_paid, 0)
        then (coalesce(vep.paid_total, 0) + coalesce(oep.paid_total, 0)) - coalesce(cp.total_paid, 0)
        else 0
    end)::numeric(14,2) as backlog_amount
   from projects p
     left join client_paid cp on cp.project_id = p.id
     left join po_committed poc on poc.project_id = p.id
     left join vendor_expense_paid vep on vep.project_id = p.id
     left join operational_expense_paid oep on oep.project_id = p.id
     left join tax_paid tp on tp.project_id = p.id;

-- 2) Accrual reports.
create or replace function private.report_accumulated_depreciation(p_to date)
returns numeric
language sql
stable
security invoker
set search_path = public
as $$
  select private.report_money(sum(
    case
      when lifespan_years <= 0 then 0
      else least(cost, cost * months_used::numeric / (lifespan_years * 12))
    end
  ))
  from (
    select
      coalesce(a.total_cost, a.unit_cost * a.quantity) as cost,
      a.lifespan_years,
      least(
        greatest(a.lifespan_years, 0) * 12,
        greatest(
          0,
          (
            extract(year from age(p_to::timestamp, a.purchase_date::timestamp)) * 12
            + extract(month from age(p_to::timestamp, a.purchase_date::timestamp))
          )::int
        )
      ) as months_used
    from public.assets a
    where p_to is not null
      and a.purchase_date <= p_to
  ) valued;
$$;
revoke all on function private.report_accumulated_depreciation(date) from public, anon, authenticated;

-- Same buckets as private.report_profit, but revenue on the client invoice
-- date and vendor cost on the vendor bill date; adds period depreciation.
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
      po.work_type
    from public.vendor_invoices vi
    join public.vendor_purchase_orders po on po.id = vi.purchase_order_id
    where vi.status is distinct from 'void'
      and coalesce(vi.issued_on, vi.created_at::date) between p_from and p_to
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
      coalesce((select sum(v.amount) from vendor v where not v.project_linked), 0)
      + coalesce((
        select sum(o.amount) from operational o
        where o.project_id is null and o.bucket not in ('marketing', 'salary', 'admin')
      ), 0)
    ),
    'marketing', private.report_money((
      select sum(o.amount) from operational o
      where o.project_id is null and o.bucket = 'marketing'
    )),
    'salary', private.report_money(
      coalesce((
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
    'admin', private.report_money((
      select sum(o.amount) from operational o
      where o.project_id is null and o.bucket = 'admin'
    )),
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

create or replace function private.report_ar_aging(p_to date)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with open_items as (
    select
      coalesce(nullif(btrim(c.person_name), ''), nullif(btrim(c.company_name), ''), 'Client') as party,
      coalesce(nullif(btrim(p.name), ''), 'Project') as project,
      coalesce(nullif(btrim(ci.description), ''), 'Invoice') as reference,
      coalesce(ci.due_on, ci.issued_on) as due_on,
      (least(p_to, (timezone('Asia/Dhaka', now()))::date) - coalesce(ci.due_on, ci.issued_on))::integer as days,
      private.report_money(ci.amount - coalesce(paid.total_paid, 0)) as amount
    from public.client_invoices ci
    join public.clients c on c.id = ci.client_id
    join public.projects p on p.id = ci.project_id
    left join lateral (
      select coalesce(sum(cp.amount), 0) as total_paid
      from public.client_payments cp
      where cp.client_invoice_id = ci.id
        and cp.paid_on <= p_to
    ) paid on true
    where ci.status is distinct from 'void'
      and ci.issued_on <= p_to
      and ci.amount - coalesce(paid.total_paid, 0) > 0
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
$$;

create or replace function private.report_ap_aging(p_to date)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with open_items as (
    select
      coalesce(nullif(btrim(v.person_name), ''), nullif(btrim(v.company_name), ''), 'Vendor') as party,
      coalesce(nullif(btrim(p.name), ''), 'Operational') as project,
      coalesce(nullif(btrim(po.work_type), ''), 'Purchase Order') as reference,
      coalesce(due.due_on, po.issued_on) as due_on,
      (least(p_to, (timezone('Asia/Dhaka', now()))::date) - coalesce(due.due_on, po.issued_on))::integer as days,
      private.report_money(po.total_value - coalesce(paid.total_paid, 0)) as amount
    from public.vendor_purchase_orders po
    join public.vendors v on v.id = po.vendor_id
    left join public.projects p on p.id = po.project_id
    left join lateral (
      select min(vi.due_on) as due_on
      from public.vendor_invoices vi
      where vi.purchase_order_id = po.id
        and vi.due_on is not null
    ) due on true
    left join lateral (
      select coalesce(sum(vp.amount), 0) as total_paid
      from public.vendor_invoices vi
      join public.vendor_payments vp on vp.vendor_invoice_id = vi.id
      where vi.purchase_order_id = po.id
        and vp.paid_on <= p_to
    ) paid on true
    where po.issued_on <= p_to
      and po.total_value - coalesce(paid.total_paid, 0) > 0
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
$$;

create or replace function private.report_project_profit(p_from date, p_to date)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with revenue as (
    select ci.project_id, coalesce(sum(ci.amount), 0) as amount
    from public.client_invoices ci
    where ci.status is distinct from 'void'
      and coalesce(ci.issued_on, ci.created_at::date) between p_from and p_to
    group by ci.project_id
  ),
  vendor_cost as (
    select po.project_id, coalesce(sum(vi.amount), 0) as amount
    from public.vendor_invoices vi
    join public.vendor_purchase_orders po on po.id = vi.purchase_order_id
    where vi.status is distinct from 'void'
      and coalesce(vi.issued_on, vi.created_at::date) between p_from and p_to
      and po.project_id is not null
    group by po.project_id
  ),
  overhead as (
    select project_id, coalesce(sum(amount), 0) as amount
    from public.operational_expenses
    where expense_date between p_from and p_to
      and project_id is not null
    group by project_id
  ),
  tax as (
    select project_id, coalesce(sum(amount), 0) as amount
    from public.vat_tax_payments
    where paid_on between p_from and p_to
    group by project_id
  ),
  rows as (
    select
      p.name as project,
      coalesce(nullif(btrim(c.person_name), ''), nullif(btrim(c.company_name), ''), 'Client') as client,
      private.report_money(coalesce(r.amount, 0)) as revenue,
      private.report_money(coalesce(vc.amount, 0) + coalesce(o.amount, 0)) as project_expense,
      private.report_money(coalesce(t.amount, 0)) as tax
    from public.projects p
    join public.clients c on c.id = p.client_id
    left join revenue r on r.project_id = p.id
    left join vendor_cost vc on vc.project_id = p.id
    left join overhead o on o.project_id = p.id
    left join tax t on t.project_id = p.id
    where coalesce(r.amount, 0) <> 0
      or coalesce(vc.amount, 0) <> 0
      or coalesce(o.amount, 0) <> 0
      or coalesce(t.amount, 0) <> 0
  ),
  unassigned as (
    select 0::numeric as amount
  ),
  combined as (
    select project, client, revenue, project_expense, tax
    from rows
    union all
    select
      'Not Linked To A Project',
      '—',
      0::numeric,
      amount,
      0::numeric
    from unassigned
    where coalesce(amount, 0) <> 0
  )
  select jsonb_build_object(
    'rows', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'project', project,
          'client', client,
          'revenue', revenue,
          'project_expense', project_expense,
          'tax', tax,
          'gross_profit', private.report_money(revenue - project_expense - tax)
        )
        order by project
      )
      from combined
    ), '[]'::jsonb),
    'totals', (
      select jsonb_build_object(
        'revenue', private.report_money(sum(revenue)),
        'project_expense', private.report_money(sum(project_expense)),
        'tax', private.report_money(sum(tax)),
        'gross_profit', private.report_money(sum(revenue - project_expense - tax))
      )
      from combined
    )
  );
$$;
create or replace function public.financial_report(p_from date, p_to date)
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
      v_ar_total := greatest(v_ar_net, 0);
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
      if v_ap_net < 0 then
        v_asset_sum := v_asset_sum - v_ap_net;
        v_lines := v_lines || jsonb_build_array(
          jsonb_build_object('label', 'Vendor Advances', 'amount', -v_ap_net, 'emphasis', 'plain')
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
        v_ap_total := greatest(v_ap_net, 0);
        v_liability_sum := v_liability_sum + v_ap_total;
        v_lines := v_lines || jsonb_build_array(
          jsonb_build_object('label', 'Accounts Payable', 'amount', v_ap_total, 'emphasis', 'plain')
        );
      end if;
      if v_ar and v_ar_net < 0 then
        v_liability_sum := v_liability_sum - v_ar_net;
        v_lines := v_lines || jsonb_build_array(
          jsonb_build_object('label', 'Customer Advances', 'amount', -v_ar_net, 'emphasis', 'plain')
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

revoke all on function private.report_ar_aging(date) from public, anon, authenticated;
revoke all on function private.report_ap_aging(date) from public, anon, authenticated;
revoke all on function private.report_project_profit(date, date) from public, anon, authenticated;
revoke all on function public.financial_report(date, date) from public, anon;
grant execute on function public.financial_report(date, date) to authenticated;
revoke all on function private.guard_client_invoice_floor() from public, anon, authenticated;
revoke all on function private.guard_vendor_invoice_floor() from public, anon, authenticated;
revoke all on function private.guard_purchase_order_floor() from public, anon, authenticated;
revoke all on function private.guard_payment_not_future() from public, anon, authenticated;

-- 7) Activity log pages newest first.
create index if not exists activity_log_created_at_desc_idx
  on public.activity_log (created_at desc);
