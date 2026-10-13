-- Year-scoped dashboard. Null year is All Time.
-- Profit uses the same buckets as the dashboard and financial reports:
-- Gross Profit = project revenue - (project expense + tax).
-- Net Profit = Gross Profit - admin expense.
-- The current year runs through today in Asia/Dhaka.
-- This file is not applied by the app. Apply it with the normal migration flow.

create schema if not exists private;

create or replace function private.dashboard_delta(current_value numeric, prior_value numeric)
returns numeric
language sql
immutable
as $$
  select case
    when coalesce(prior_value, 0) = 0 then null
    when ((current_value - prior_value) / abs(prior_value)) * 100 > 999.9 then 999.9
    when ((current_value - prior_value) / abs(prior_value)) * 100 < -999.9 then -999.9
    else ((current_value - prior_value) / abs(prior_value)) * 100
  end;
$$;

create or replace function private.dashboard_ratio(part numeric, whole numeric)
returns numeric
language sql
immutable
as $$
  select case
    when coalesce(whole, 0) = 0 then 0
    else (coalesce(part, 0) / whole) * 100
  end;
$$;

-- Component totals for a date span. Security invoker so a definer caller
-- still reads with that caller's rights.
create or replace function private.dashboard_components(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  parts jsonb;
  revenue numeric;
  material numeric;
  subcontractor numeric;
  overhead numeric;
  operational numeric;
  marketing numeric;
  salary numeric;
  admin numeric;
  tax numeric;
  project_expense numeric;
  admin_expense numeric;
  total numeric;
  withdrawal numeric;
begin
  if p_from is null or p_to is null or p_from > p_to then
    parts := '{}'::jsonb;
  else
    parts := private.report_profit(p_from, p_to);
  end if;

  revenue := coalesce((parts->>'revenue')::numeric, 0);
  material := coalesce((parts->>'material')::numeric, 0);
  subcontractor := coalesce((parts->>'subcontractor')::numeric, 0);
  overhead := coalesce((parts->>'project_overhead')::numeric, 0);
  operational := coalesce((parts->>'operational')::numeric, 0);
  marketing := coalesce((parts->>'marketing')::numeric, 0);
  salary := coalesce((parts->>'salary')::numeric, 0);
  admin := coalesce((parts->>'admin')::numeric, 0);
  tax := coalesce((parts->>'tax')::numeric, 0);
  project_expense := material + subcontractor + overhead;
  admin_expense := operational + marketing + salary + admin;
  total := project_expense + tax + admin_expense;

  select coalesce(sum(bt.amount), 0)
  into withdrawal
  from public.bank_transactions bt
  where p_from <= p_to
    and bt.transaction_date between p_from and p_to
    and bt.source_kind = 'withdrawal'
    and bt.direction = 'outflow';

  return jsonb_build_object(
    'revenue', revenue,
    'material', material,
    'subcontractor', subcontractor,
    'project_overhead', overhead,
    'operational', operational,
    'marketing', marketing,
    'salary', salary,
    'admin', admin,
    'tax', tax,
    'project_expense', project_expense,
    'admin_expense', admin_expense,
    'total', total,
    'gross', revenue - project_expense - tax,
    'net', revenue - project_expense - tax - admin_expense,
    'withdrawal', withdrawal
  );
end;
$$;

create or replace function private.dashboard_cash(p_as_of date)
returns numeric
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce((select sum(opening_balance) from public.bank_accounts), 0)
    + coalesce((
      select sum(case when direction = 'inflow' then amount else -amount end)
      from public.bank_transactions
      where transaction_date <= p_as_of
        and source_kind is not null
        and direction in ('inflow', 'outflow')
    ), 0);
$$;

revoke all on function private.dashboard_delta(numeric, numeric) from public, anon, authenticated;
revoke all on function private.dashboard_ratio(numeric, numeric) from public, anon, authenticated;
revoke all on function private.dashboard_components(date, date) from public, anon, authenticated;
revoke all on function private.dashboard_cash(date) from public, anon, authenticated;

create or replace function public.dashboard_scope(p_year integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
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
    select coalesce(sum(greatest(ci.amount - coalesce(paid.total_paid, 0), 0)), 0)
    into v_receivables
    from public.client_invoices ci
    join public.projects p on p.id = ci.project_id
    join public.clients c on c.id = ci.client_id
    left join lateral (
      select coalesce(sum(cp.amount), 0) as total_paid
      from public.client_payments cp
      where cp.client_invoice_id = ci.id
    ) paid on true
    where ci.status is distinct from 'void';

    select coalesce(sum(greatest(po.total_value - coalesce(paid.total_paid, 0), 0)), 0)
    into v_payables
    from public.vendor_purchase_orders po
    join public.projects p on p.id = po.project_id
    join public.vendors v on v.id = po.vendor_id
    left join lateral (
      select coalesce(sum(vp.amount), 0) as total_paid
      from public.vendor_invoices vi
      join public.vendor_payments vp on vp.vendor_invoice_id = vi.id
      where vi.purchase_order_id = po.id
    ) paid on true;
  else
    select coalesce(sum(greatest(ci.amount - coalesce(paid.total_paid, 0), 0)), 0)
    into v_receivables
    from public.client_invoices ci
    join public.projects p on p.id = ci.project_id
    join public.clients c on c.id = ci.client_id
    left join lateral (
      select coalesce(sum(cp.amount), 0) as total_paid
      from public.client_payments cp
      where cp.client_invoice_id = ci.id
        and cp.paid_on <= v_to
    ) paid on true
    where ci.status is distinct from 'void'
      and ci.issued_on <= v_to;

    select coalesce(sum(greatest(po.total_value - coalesce(paid.total_paid, 0), 0)), 0)
    into v_payables
    from public.vendor_purchase_orders po
    join public.projects p on p.id = po.project_id
    join public.vendors v on v.id = po.vendor_id
    left join lateral (
      select coalesce(sum(vp.amount), 0) as total_paid
      from public.vendor_invoices vi
      join public.vendor_payments vp on vp.vendor_invoice_id = vi.id
      where vi.purchase_order_id = po.id
        and vp.paid_on <= v_to
    ) paid on true
    where po.issued_on <= v_to;
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
      'collection_efficiency', private.dashboard_ratio(v_revenue, v_contract),
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
$$;

revoke all on function public.dashboard_scope(integer) from public, anon;
grant execute on function public.dashboard_scope(integer) to authenticated;
