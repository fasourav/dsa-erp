-- Operational purchase orders carry an office expense category.
-- The column is nullable so existing rows stay valid. New operational
-- purchase orders are required in the app. Project purchase orders keep
-- expense_category_id and leave this null.
-- This file is not applied by the app. Apply it with the normal migration flow.

alter table private.vendor_purchase_orders
  add column office_expense_category_id uuid
  references public.office_expense_categories (id) on delete restrict;

comment on column private.vendor_purchase_orders.office_expense_category_id is
  'Office expense category for an operational purchase order. Null on project purchase orders and on operational purchase orders saved before a category was chosen.';

create index vendor_purchase_orders_office_expense_category_id_idx
  on private.vendor_purchase_orders (office_expense_category_id);

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
  expense_category_id,
  office_expense_category_id
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
      created_at, updated_at, expense_category_id, office_expense_category_id
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
      new.expense_category_id,
      new.office_expense_category_id
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
      expense_category_id = new.expense_category_id,
      office_expense_category_id = new.office_expense_category_id
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

-- Operational purchase orders were numbered with project code NA.
-- Keep the previous number in a backup table, then replace that code with OPS.
-- A number that is already taken gains -2, -3, … the same way a new document does.

create table private.bak_20261023_po_numbers (
  source text not null,
  id uuid not null,
  document_no text not null,
  primary key (source, id)
);

comment on table private.bak_20261023_po_numbers is
  'Document numbers of operational purchase orders before the project code changed from NA to OPS.';

alter table private.bak_20261023_po_numbers enable row level security;

revoke all on table private.bak_20261023_po_numbers from public, anon, authenticated;

do $$
declare
  rec record;
  candidate text;
  base text;
  n integer;
begin
  for rec in
    select 'work_orders'::text as source, w.id, w.document_no
    from private.work_orders w
    join private.vendor_purchase_orders po on po.id = w.purchase_order_id
    where po.project_id is null
      and w.document_no ~ '-NA(-[0-9]+)?$'
    union all
    select 'issued_documents', d.id, d.document_no
    from public.issued_documents d
    join private.vendor_purchase_orders po on po.id = d.purchase_order_id
    where d.kind = 'purchase_order'
      and po.project_id is null
      and d.document_no ~ '-NA(-[0-9]+)?$'
    order by 1, 3
  loop
    insert into private.bak_20261023_po_numbers (source, id, document_no)
    values (rec.source, rec.id, rec.document_no);

    candidate := regexp_replace(rec.document_no, '-NA(-[0-9]+)?$', '-OPS\1');
    base := regexp_replace(candidate, '-[0-9]+$', '');
    n := 2;
    while exists (
      select 1 from public.quotations
      where document_no = candidate
    ) or exists (
      select 1 from private.work_orders
      where document_no = candidate
        and not (rec.source = 'work_orders' and id = rec.id)
    ) or exists (
      select 1 from public.issued_documents
      where document_no = candidate
        and not (rec.source = 'issued_documents' and id = rec.id)
    ) loop
      candidate := base || '-' || n::text;
      n := n + 1;
      if n > 100 then
        raise exception 'Could not renumber purchase order document %', rec.document_no;
      end if;
    end loop;

    if rec.source = 'work_orders' then
      update private.work_orders
      set document_no = candidate
      where id = rec.id
        and document_no is distinct from candidate;
    else
      update public.issued_documents
      set document_no = candidate
      where id = rec.id
        and document_no is distinct from candidate;
    end if;
  end loop;

  update public.issued_documents as document
  set body = jsonb_set(document.body, '{workOrderNo}', to_jsonb(work_order.document_no), false)
  from private.work_orders as work_order
  join private.bak_20261023_po_numbers as backup
    on backup.source = 'work_orders'
   and backup.id = work_order.id
  where document.body->>'workOrderNo' = backup.document_no
    and document.body->>'workOrderNo' is distinct from work_order.document_no;
end;
$$;

-- Cash profit: a payment on an operational purchase order is bucketed by its
-- office expense category, then the work type, then Operational. The buckets
-- match operational expenses (admin, salary, marketing, operational).
-- Project payments still use the project expense category, then the work type,
-- for Material vs Subcontractor.
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
          private.report_admin_bucket(
            case
              when btrim(coalesce(office.name, '')) <> '' then office.name
              when btrim(coalesce(po.work_type, '')) <> '' then po.work_type
              else 'Operational'
            end
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

-- Accrual profit uses the bill date. Material vs Subcontractor follows the
-- purchase order expense category, then the work type, matching report_profit.
-- Bills on an operational purchase order use the same office-category buckets.
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
          private.report_admin_bucket(
            case
              when btrim(coalesce(office.name, '')) <> '' then office.name
              when btrim(coalesce(po.work_type, '')) <> '' then po.work_type
              else 'Operational'
            end
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

-- Cash flow: a vendor payment whose bank line has no project is Operational
-- Expenses. A vendor payment on a project stays Vendor Payments.
-- The rest of financial_report is unchanged.

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
        case
          when bt.source_kind = 'project_income' then 'Client Collections'
          when bt.source_kind = 'vendor_expense' and bt.project_id is null then 'Operational Expenses'
          when bt.source_kind = 'vendor_expense' then 'Vendor Payments'
          when bt.source_kind = 'operational_expense' then 'Operational Expenses'
          when bt.source_kind = 'vat_tax' then 'Tax Payments'
          when bt.source_kind = 'payroll' then 'Payroll'
          when bt.source_kind = 'deposit' then 'Owner Deposits'
          when bt.source_kind = 'withdrawal' then 'Owner Withdrawals'
          when bt.source_kind = 'transfer' then 'Internal Transfers'
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

notify pgrst, 'reload schema';
