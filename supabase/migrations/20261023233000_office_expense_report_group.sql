-- Office expense categories choose their report group.
-- The group is operational, marketing, or salary.
-- Admin Expense is the sum of those three, not a fourth group.
-- The old keyword guess stays. A result of admin counts as operational.
-- This file is not applied by the app. Apply it with the normal migration flow.
--
-- No view selects this table. The activity trigger logs to_jsonb(new),
-- so the new column is included without rewriting the trigger.
-- project_budget_actual_rows groups project spend by project expense
-- category. It does not use this bucket, so it stays as it is.
-- The profit functions still return an admin key. It is zero, because
-- nothing resolves to admin. dashboard_components and retained earnings
-- still add that key, so gross, net, and the admin expense total match
-- the previous figures for every period.

alter table public.office_expense_categories
  add column report_group text;

alter table public.office_expense_categories
  add constraint office_expense_categories_report_group_check
  check (report_group in ('operational', 'marketing', 'salary'));

comment on column public.office_expense_categories.report_group is
  'Part of Admin Expense: operational, marketing, or salary.';

-- Keyword rule with admin mapped to operational. report_admin_bucket stays.
create or replace function private.report_office_group(category text)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select case private.report_admin_bucket(category)
    when 'admin' then 'operational'
    else private.report_admin_bucket(category)
  end;
$$;

comment on function private.report_office_group(text) is
  'Office cost keyword group. Same as report_admin_bucket, except admin counts as operational.';

revoke all on function private.report_office_group(text) from public, anon, authenticated;

-- Named rows get the group the business chose. Any other existing row
-- uses the keyword rule, with admin counting as operational.
update public.office_expense_categories
set report_group = case lower(btrim(name))
  when 'employee salary' then 'salary'
  when 'office rent' then 'operational'
  when 'office materials' then 'operational'
  when 'legal' then 'operational'
  when 'internet bill' then 'operational'
  else private.report_office_group(name)
end
where report_group is null;

alter table public.office_expense_categories
  alter column report_group set default 'operational',
  alter column report_group set not null;

-- Category id, else category name, else the department name through the
-- keyword rule, else the keyword rule on the category name.
-- report_admin_bucket stays. Anything it would call admin is operational.
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
      then private.report_office_group(p_department_name)
      else null
    end,
    private.report_office_group(p_category_name)
  );
$$;

comment on function private.report_cost_group(uuid, text, text) is
  'Office cost group. Category report_group by id, else by name, else the department name through report_office_group, else report_office_group on the category name.';

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
            private.report_office_group(
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
            private.report_office_group(
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
        where o.project_id is null and o.bucket = 'operational'
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


-- Profit and loss. Office And Admin is not a line. Admin Expense stays
-- the subtotal: operational + marketing + salary + the admin key + depreciation.
-- The admin key is zero, so the subtotal, gross profit, and net profit match
-- the previous report for every period. Retained earnings still subtracts the key.
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
