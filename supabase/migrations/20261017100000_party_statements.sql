-- Read-only vendor and client statements. Bill-based accrual.
-- Does not change AP/AR aging, balances, or any existing money function.
-- Purchase orders are reference text only; they are not amounts owed.
-- Closing balance as of p_to equals that party's AP/AR aging total when no
-- bill is overpaid (payment caps already reject an amount above the bill).

create or replace function private.vendor_statement(
  p_vendor_id uuid,
  p_from date,
  p_to date
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $function$
declare
  v_party text;
  v_opening numeric;
  v_debit numeric;
  v_credit numeric;
  v_closing numeric;
  v_lines jsonb;
begin
  if p_vendor_id is null
    or p_from is null
    or p_to is null
    or p_from > p_to
    or not (
      private.can('vendors', 'view')
      and private.can('accounts_payable', 'view')
    )
  then
    return jsonb_build_object('allowed', false);
  end if;

  select coalesce(nullif(btrim(v.person_name), ''), nullif(btrim(v.company_name), ''), 'Vendor')
  into v_party
  from public.vendors v
  where v.id = p_vendor_id;

  if v_party is null then
    return jsonb_build_object('allowed', false);
  end if;

  with bill as (
    select
      vi.id,
      coalesce(vi.issued_on, vi.created_at::date) as occurred_on,
      0 as sort_kind,
      'bill'::text as kind,
      coalesce(nullif(btrim(po.work_type), ''), 'Vendor Bill') as reference,
      coalesce(nullif(btrim(p.name), ''), 'Operational') as project,
      coalesce(nullif(btrim(vi.description), ''), '') as detail,
      round(vi.amount, 2) as debit,
      0::numeric as credit
    from public.vendor_invoices vi
    join public.vendor_purchase_orders po on po.id = vi.purchase_order_id
    left join public.projects p on p.id = po.project_id
    where po.vendor_id = p_vendor_id
      and vi.status is distinct from 'void'
      and coalesce(vi.issued_on, vi.created_at::date) <= p_to
  ),
  pay as (
    select
      vp.id,
      vp.paid_on as occurred_on,
      1 as sort_kind,
      'payment'::text as kind,
      coalesce(nullif(btrim(vp.reference), ''), 'Payment') as reference,
      b.project,
      coalesce(nullif(btrim(vp.notes), ''), b.reference) as detail,
      0::numeric as debit,
      round(vp.amount, 2) as credit
    from public.vendor_payments vp
    join bill b on b.id = vp.vendor_invoice_id
    where vp.paid_on <= p_to
  ),
  movement as (
    select id, occurred_on, sort_kind, kind, reference, project, detail, debit, credit from bill
    union all
    select id, occurred_on, sort_kind, kind, reference, project, detail, debit, credit from pay
  ),
  opening as (
    select round(coalesce(sum(debit - credit), 0), 2) as amount
    from movement
    where occurred_on < p_from
  ),
  period as (
    select
      m.occurred_on,
      m.sort_kind,
      m.id,
      m.kind,
      m.reference,
      m.project,
      m.detail,
      m.debit,
      m.credit,
      round(
        (select amount from opening)
        + sum(m.debit - m.credit) over (
          order by m.occurred_on, m.sort_kind, m.id
          rows between unbounded preceding and current row
        ),
        2
      ) as running
    from movement m
    where m.occurred_on >= p_from
  ),
  totals as (
    select
      round(coalesce(sum(debit), 0), 2) as debit,
      round(coalesce(sum(credit), 0), 2) as credit,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'occurred_on', occurred_on,
            'kind', kind,
            'reference', reference,
            'project', project,
            'detail', detail,
            'debit', debit,
            'credit', credit,
            'running', running
          )
          order by occurred_on, sort_kind, id
        ),
        '[]'::jsonb
      ) as lines
    from period
  )
  select
    opening.amount,
    totals.debit,
    totals.credit,
    round(opening.amount + totals.debit - totals.credit, 2),
    totals.lines
  into v_opening, v_debit, v_credit, v_closing, v_lines
  from opening
  cross join totals;

  return jsonb_build_object(
    'allowed', true,
    'party', v_party,
    'opening', v_opening,
    'debit', v_debit,
    'credit', v_credit,
    'closing', v_closing,
    'lines', v_lines
  );
end;
$function$;

create or replace function private.client_statement(
  p_client_id uuid,
  p_from date,
  p_to date,
  p_project_id uuid default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $function$
declare
  v_party text;
  v_opening numeric;
  v_debit numeric;
  v_credit numeric;
  v_closing numeric;
  v_lines jsonb;
begin
  if p_client_id is null
    or p_from is null
    or p_to is null
    or p_from > p_to
    or not (
      private.can('clients', 'view')
      and private.can('accounts_receivable', 'view')
    )
  then
    return jsonb_build_object('allowed', false);
  end if;

  select coalesce(nullif(btrim(c.person_name), ''), nullif(btrim(c.company_name), ''), 'Client')
  into v_party
  from public.clients c
  where c.id = p_client_id;

  if v_party is null then
    return jsonb_build_object('allowed', false);
  end if;

  with bill as (
    select
      ci.id,
      ci.issued_on as occurred_on,
      0 as sort_kind,
      'bill'::text as kind,
      coalesce(nullif(btrim(ci.description), ''), 'Invoice') as reference,
      coalesce(nullif(btrim(p.name), ''), 'Project') as project,
      ''::text as detail,
      round(ci.amount, 2) as debit,
      0::numeric as credit
    from public.client_invoices ci
    join public.projects p on p.id = ci.project_id
    where ci.client_id = p_client_id
      and ci.status is distinct from 'void'
      and ci.issued_on <= p_to
      and (p_project_id is null or ci.project_id = p_project_id)
  ),
  pay as (
    select
      cp.id,
      cp.paid_on as occurred_on,
      1 as sort_kind,
      'payment'::text as kind,
      coalesce(nullif(btrim(cp.reference), ''), 'Payment') as reference,
      b.project,
      coalesce(nullif(btrim(cp.notes), ''), b.reference) as detail,
      0::numeric as debit,
      round(cp.amount, 2) as credit
    from public.client_payments cp
    join bill b on b.id = cp.client_invoice_id
    where cp.paid_on <= p_to
  ),
  movement as (
    select id, occurred_on, sort_kind, kind, reference, project, detail, debit, credit from bill
    union all
    select id, occurred_on, sort_kind, kind, reference, project, detail, debit, credit from pay
  ),
  opening as (
    select round(coalesce(sum(debit - credit), 0), 2) as amount
    from movement
    where occurred_on < p_from
  ),
  period as (
    select
      m.occurred_on,
      m.sort_kind,
      m.id,
      m.kind,
      m.reference,
      m.project,
      m.detail,
      m.debit,
      m.credit,
      round(
        (select amount from opening)
        + sum(m.debit - m.credit) over (
          order by m.occurred_on, m.sort_kind, m.id
          rows between unbounded preceding and current row
        ),
        2
      ) as running
    from movement m
    where m.occurred_on >= p_from
  ),
  totals as (
    select
      round(coalesce(sum(debit), 0), 2) as debit,
      round(coalesce(sum(credit), 0), 2) as credit,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'occurred_on', occurred_on,
            'kind', kind,
            'reference', reference,
            'project', project,
            'detail', detail,
            'debit', debit,
            'credit', credit,
            'running', running
          )
          order by occurred_on, sort_kind, id
        ),
        '[]'::jsonb
      ) as lines
    from period
  )
  select
    opening.amount,
    totals.debit,
    totals.credit,
    round(opening.amount + totals.debit - totals.credit, 2),
    totals.lines
  into v_opening, v_debit, v_credit, v_closing, v_lines
  from opening
  cross join totals;

  return jsonb_build_object(
    'allowed', true,
    'party', v_party,
    'opening', v_opening,
    'debit', v_debit,
    'credit', v_credit,
    'closing', v_closing,
    'lines', v_lines
  );
end;
$function$;

-- Public wrappers so the app can call them. Invoker, so RLS still applies.
create or replace function public.vendor_statement(
  p_vendor_id uuid,
  p_from date,
  p_to date
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $function$
  select private.vendor_statement(p_vendor_id, p_from, p_to);
$function$;

create or replace function public.client_statement(
  p_client_id uuid,
  p_from date,
  p_to date,
  p_project_id uuid default null
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $function$
  select private.client_statement(p_client_id, p_from, p_to, p_project_id);
$function$;

revoke all on function private.vendor_statement(uuid, date, date) from public, anon;
revoke all on function private.client_statement(uuid, date, date, uuid) from public, anon;
grant execute on function private.vendor_statement(uuid, date, date) to authenticated;
grant execute on function private.client_statement(uuid, date, date, uuid) to authenticated;

revoke all on function public.vendor_statement(uuid, date, date) from public, anon;
revoke all on function public.client_statement(uuid, date, date, uuid) from public, anon;
grant execute on function public.vendor_statement(uuid, date, date) to authenticated;
grant execute on function public.client_statement(uuid, date, date, uuid) to authenticated;

notify pgrst, 'reload schema';
