-- Financial reports and owner backup log.
-- Profit matches the dashboard: Gross Profit = project revenue - (project expense + tax).
-- Net Profit = Gross Profit - admin expense (operational, marketing, salaries, and office admin).
-- This file is not applied by the app. Apply it with the normal migration flow.

create schema if not exists private;

create or replace function private.report_is_material(work_type text)
returns boolean
language sql
immutable
as $$
  select position('material' in lower(coalesce(work_type, ''))) > 0
    or position('supply' in lower(coalesce(work_type, ''))) > 0
    or position('goods' in lower(coalesce(work_type, ''))) > 0;
$$;

create or replace function private.report_admin_bucket(category text)
returns text
language sql
immutable
as $$
  select case
    when lower(btrim(coalesce(category, ''))) ~ '(salary|payroll|wage)' then 'salary'
    when lower(btrim(coalesce(category, ''))) ~ '(market|advert|promotion)' then 'marketing'
    when lower(btrim(coalesce(category, ''))) ~ '(admin|office|rent|utilit)' then 'admin'
    else 'operational'
  end;
$$;

create or replace function private.report_aging_bucket(days integer)
returns text
language sql
immutable
as $$
  select case
    when days <= 30 then '0-30'
    when days <= 60 then '31-60'
    when days <= 90 then '61-90'
    else '90+'
  end;
$$;

create or replace function private.report_money(amount numeric)
returns numeric
language sql
immutable
as $$
  select round(coalesce(amount, 0), 2);
$$;

-- Component totals for a date span. Called only after the public function
-- has checked the caller. Security invoker so it runs as that definer.
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
      po.work_type
    from public.vendor_payments vp
    left join public.vendor_invoices vi on vi.id = vp.vendor_invoice_id
    left join public.vendor_purchase_orders po on po.id = vi.purchase_order_id
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

revoke all on function private.report_is_material(text) from public, anon, authenticated;
revoke all on function private.report_admin_bucket(text) from public, anon, authenticated;
revoke all on function private.report_aging_bucket(integer) from public, anon, authenticated;
revoke all on function private.report_money(numeric) from public, anon, authenticated;
revoke all on function private.report_profit(date, date) from public, anon, authenticated;

create or replace function public.financial_report(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
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
    v_profit := private.report_profit(p_from, p_to);
    v_revenue := (v_profit->>'revenue')::numeric;
    v_material := (v_profit->>'material')::numeric;
    v_subcontractor := (v_profit->>'subcontractor')::numeric;
    v_overhead := (v_profit->>'project_overhead')::numeric;
    v_operational := (v_profit->>'operational')::numeric;
    v_marketing := (v_profit->>'marketing')::numeric;
    v_salary := (v_profit->>'salary')::numeric;
    v_admin := (v_profit->>'admin')::numeric;
    v_tax := (v_profit->>'tax')::numeric;
    v_project_expense := private.report_money(v_material + v_subcontractor + v_overhead);
    v_admin_expense := private.report_money(v_operational + v_marketing + v_salary + v_admin);
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
    v_lines := '[]'::jsonb;
    v_asset_sum := 0;
    v_liability_sum := 0;

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
      select private.report_money(sum(greatest(ci.amount - coalesce(paid.total_paid, 0), 0)))
      into v_ar_total
      from public.client_invoices ci
      left join lateral (
        select coalesce(sum(cp.amount), 0) as total_paid
        from public.client_payments cp
        where cp.client_invoice_id = ci.id
          and cp.paid_on <= p_to
      ) paid on true
      where ci.status is distinct from 'void'
        and ci.issued_on <= p_to;
      v_ar_total := coalesce(v_ar_total, 0);
      v_asset_sum := v_asset_sum + v_ar_total;
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object('label', 'Accounts Receivable', 'amount', v_ar_total, 'emphasis', 'plain')
      );
    end if;

    if v_assets then
      select private.report_money(sum(nbv))
      into v_asset_total
      from (
        select greatest(
          cost - case
            when lifespan_years <= 0 then 0
            else least(
              cost,
              cost * months_used::numeric / (lifespan_years * 12)
            )
          end,
          0
        ) as nbv
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
          where a.purchase_date <= p_to
        ) valued
      ) books;
      v_asset_total := coalesce(v_asset_total, 0);
      v_asset_sum := v_asset_sum + v_asset_total;
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object('label', 'Fixed Assets', 'amount', v_asset_total, 'emphasis', 'plain')
      );
    end if;

    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object('label', 'Total Assets', 'amount', private.report_money(v_asset_sum), 'emphasis', 'total')
    );

    if v_ap then
      select private.report_money(sum(greatest(po.total_value - coalesce(paid.total_paid, 0), 0)))
      into v_ap_total
      from public.vendor_purchase_orders po
      left join lateral (
        select coalesce(sum(vp.amount), 0) as total_paid
        from public.vendor_invoices vi
        join public.vendor_payments vp on vp.vendor_invoice_id = vi.id
        where vi.purchase_order_id = po.id
          and vp.paid_on <= p_to
      ) paid on true
      where po.issued_on <= p_to;
      v_ap_total := coalesce(v_ap_total, 0);
      v_liability_sum := v_ap_total;
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object('label', 'Accounts Payable', 'amount', v_ap_total, 'emphasis', 'plain'),
        jsonb_build_object('label', 'Total Liabilities', 'amount', v_ap_total, 'emphasis', 'total')
      );
    end if;

    if v_books then
      select coalesce(launch_date, date '2021-01-01')
      into v_launch
      from public.company_settings
      where id is true;
      v_launch := coalesce(v_launch, date '2021-01-01');
      if v_launch < date '2021-01-01' then
        v_launch := date '2021-01-01';
      end if;

      v_profit := private.report_profit(v_launch, p_to);
      v_revenue := (v_profit->>'revenue')::numeric;
      v_material := (v_profit->>'material')::numeric;
      v_subcontractor := (v_profit->>'subcontractor')::numeric;
      v_overhead := (v_profit->>'project_overhead')::numeric;
      v_operational := (v_profit->>'operational')::numeric;
      v_marketing := (v_profit->>'marketing')::numeric;
      v_salary := (v_profit->>'salary')::numeric;
      v_admin := (v_profit->>'admin')::numeric;
      v_tax := (v_profit->>'tax')::numeric;
      v_project_expense := v_material + v_subcontractor + v_overhead;
      v_admin_expense := v_operational + v_marketing + v_salary + v_admin;
      v_net := private.report_money(v_revenue - v_project_expense - v_tax - v_admin_expense);
      v_equity := v_net;
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object('label', 'Cumulative Net Profit', 'amount', v_net, 'emphasis', 'plain')
      );
    end if;

    if v_bank then
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
      v_deposits := coalesce(v_deposits, 0);
      v_withdrawals := coalesce(v_withdrawals, 0);
      v_equity := private.report_money(v_equity + v_deposits + v_withdrawals);
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object('label', 'Owner Deposits', 'amount', v_deposits, 'emphasis', 'plain'),
        jsonb_build_object('label', 'Owner Withdrawals', 'amount', v_withdrawals, 'emphasis', 'plain')
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
$$;

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
      (p_to - coalesce(ci.due_on, ci.issued_on))::integer as days,
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
      (p_to - coalesce(due.due_on, po.issued_on))::integer as days,
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
    select ci.project_id, coalesce(sum(cp.amount), 0) as amount
    from public.client_payments cp
    join public.client_invoices ci on ci.id = cp.client_invoice_id
    where cp.paid_on between p_from and p_to
    group by ci.project_id
  ),
  vendor_cost as (
    select po.project_id, coalesce(sum(vp.amount), 0) as amount
    from public.vendor_payments vp
    join public.vendor_invoices vi on vi.id = vp.vendor_invoice_id
    join public.vendor_purchase_orders po on po.id = vi.purchase_order_id
    where vp.paid_on between p_from and p_to
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
    select private.report_money(sum(vp.amount)) as amount
    from public.vendor_payments vp
    left join public.vendor_invoices vi on vi.id = vp.vendor_invoice_id
    left join public.vendor_purchase_orders po on po.id = vi.purchase_order_id
    where vp.paid_on between p_from and p_to
      and po.id is null
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

create or replace function private.report_tax(p_from date, p_to date)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with lines as (
    select
      vt.paid_on,
      coalesce(nullif(btrim(p.name), ''), 'Project') as project,
      coalesce(nullif(btrim(vt.payment_method), ''), '—') as method,
      coalesce(nullif(btrim(vt.notes), ''), '') as notes,
      private.report_money(vt.amount) as amount
    from public.vat_tax_payments vt
    left join public.projects p on p.id = vt.project_id
    where vt.paid_on between p_from and p_to
  )
  select jsonb_build_object(
    'by_project', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'project', project,
          'amount', private.report_money(amount),
          'count', item_count
        )
        order by project
      )
      from (
        select project, sum(amount) as amount, count(*)::integer as item_count
        from lines
        group by project
      ) grouped
    ), '[]'::jsonb),
    'lines', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'paid_on', paid_on,
          'project', project,
          'method', method,
          'notes', notes,
          'amount', amount
        )
        order by paid_on, project
      )
      from lines
    ), '[]'::jsonb),
    'total', private.report_money((select sum(amount) from lines))
  );
$$;

revoke all on function private.report_ar_aging(date) from public, anon, authenticated;
revoke all on function private.report_ap_aging(date) from public, anon, authenticated;
revoke all on function private.report_project_profit(date, date) from public, anon, authenticated;
revoke all on function private.report_tax(date, date) from public, anon, authenticated;

revoke all on function public.financial_report(date, date) from public, anon;
grant execute on function public.financial_report(date, date) to authenticated;

-- Owner backup is recorded as its own activity verb.
do $$
declare
  item record;
begin
  for item in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'activity_log'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%action%'
  loop
    execute format('alter table public.activity_log drop constraint %I', item.conname);
  end loop;
end $$;

alter table public.activity_log
  add constraint activity_log_action_check
  check (action in ('insert', 'update', 'delete', 'export'));

create or replace function public.record_backup(p_kind text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not private.is_owner() then
    raise exception 'Only owners can export a backup.' using errcode = '42501';
  end if;

  if p_kind not in ('excel', 'json') then
    raise exception 'Unknown backup format.';
  end if;

  insert into public.activity_log (
    actor_id,
    action,
    module,
    table_name,
    record_id,
    record_label,
    summary,
    new_values
  )
  values (
    auth.uid(),
    'export',
    'settings',
    'backup',
    p_kind,
    'Full Data Backup',
    case p_kind
      when 'excel' then 'Downloaded a full data backup (Excel).'
      else 'Downloaded a full data backup (JSON).'
    end,
    jsonb_build_object('format', p_kind)
  );
end;
$$;

revoke all on function public.record_backup(text) from public, anon;
grant execute on function public.record_backup(text) to authenticated;
