-- Single round-trip RPC for dashboard performance detail cards.
-- Mirrors loadPerformanceDetails in src/lib/dashboard-data.ts.

create or replace function public.dashboard_details(
  p_year integer,
  p_include_assets boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_today date := (timezone('Asia/Dhaka', now()))::date;
  v_current integer := extract(year from v_today)::integer;
  v_year integer := p_year;
  v_prev_month_days integer := extract(day from (date_trunc('month', v_today) - interval '1 day'))::integer;
  v_high integer := null;
  v_low integer := null;
  v_backlog_value numeric := null;
  v_vendors integer := null;
  v_asset_value numeric := null;
  r_asset record;
  v_total_cost numeric;
  v_lifespan_months numeric;
  v_years integer;
  v_months integer;
  v_days integer;
  v_elapsed numeric;
  v_used numeric;
  v_rate numeric;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not private.sees_financials() or not private.can('dashboard', 'view') then
    return null;
  end if;

  if v_year is not null and (v_year < 2021 or v_year > v_current) then
    v_year := v_current;
  end if;

  if private.can('projects', 'view') then
    select
      count(*) filter (where coalesce(p.total_value, 0) >= 50000)::integer,
      count(*) filter (where coalesce(p.total_value, 0) < 50000)::integer
    into v_high, v_low
    from public.projects p
    where v_year is null
      or (p.year between 1990 and 2200 and p.year = v_year)
      or (
        (p.year is null or p.year not between 1990 and 2200)
        and p.started_on is not null
        and extract(year from p.started_on)::integer = v_year
      );

    if private.can('backlog', 'view') then
      select round(coalesce(sum(coalesce(b.backlog_amount, 0)), 0), 2)
      into v_backlog_value
      from public.project_backlogs b
      join public.projects p on p.id = b.project_id
      where v_year is null
        or (p.year between 1990 and 2200 and p.year = v_year)
        or (
          (p.year is null or p.year not between 1990 and 2200)
          and p.started_on is not null
          and extract(year from p.started_on)::integer = v_year
        );
    end if;
  end if;

  if private.can('vendors', 'view') then
    select count(*)::integer into v_vendors from public.vendors;
  end if;

  if coalesce(p_include_assets, false) and private.can('assets', 'view') then
    v_asset_value := 0;
    for r_asset in
      select a.purchase_date, a.quantity, a.unit_cost, a.total_cost, a.lifespan_years
      from public.assets a
    loop
      v_total_cost := coalesce(r_asset.total_cost, coalesce(r_asset.quantity, 0) * coalesce(r_asset.unit_cost, 0));
      v_lifespan_months := coalesce(r_asset.lifespan_years, 0) * 12;

      if v_lifespan_months <= 0 then
        v_asset_value := v_asset_value + round(greatest(0::numeric, v_total_cost), 2);
      else
        if r_asset.purchase_date is null then
          v_elapsed := 0;
        else
          v_years := extract(year from v_today)::integer - extract(year from r_asset.purchase_date)::integer;
          v_months := extract(month from v_today)::integer - extract(month from r_asset.purchase_date)::integer;
          v_days := extract(day from v_today)::integer - extract(day from r_asset.purchase_date)::integer;

          if v_days < 0 then
            v_months := v_months - 1;
            v_days := v_days + v_prev_month_days;
          end if;

          if v_months < 0 then
            v_years := v_years - 1;
            v_months := v_months + 12;
          end if;

          if v_years < 0 then
            v_elapsed := 0;
          else
            v_elapsed := v_years * 12 + v_months + (v_days::numeric / 30.0);
          end if;
        end if;

        v_used := least(v_lifespan_months, greatest(0::numeric, v_elapsed));
        v_rate := v_total_cost / v_lifespan_months;
        v_asset_value := v_asset_value + round(greatest(0::numeric, v_total_cost - v_used * v_rate), 2);
      end if;
    end loop;
    v_asset_value := round(v_asset_value, 2);
  end if;

  return jsonb_build_object(
    'highValue', v_high,
    'lowValue', v_low,
    'backlogValue', v_backlog_value,
    'assetValue', v_asset_value,
    'vendors', v_vendors
  );
end;
$$;

revoke all on function public.dashboard_details(integer, boolean) from public, anon;
grant execute on function public.dashboard_details(integer, boolean) to authenticated;
