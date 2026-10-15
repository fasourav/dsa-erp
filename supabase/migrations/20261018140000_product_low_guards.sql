-- P-13. Template names are at most 120 characters on every write path.
-- Shorten any existing name so the check can be added. File only; do not apply from the app.

update public.document_templates
set name = left(btrim(name), 120)
where char_length(btrim(name)) > 120;

alter table public.document_templates
  drop constraint if exists document_templates_name_len;

alter table public.document_templates
  add constraint document_templates_name_len
  check (char_length(btrim(name)) <= 120);

-- P-14. Vendor statement reference is the printed purchase-order number,
-- or the bill date plus a stable bill id. Work type stays in the detail.

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
      coalesce(
        nullif(btrim(po_doc.document_no), ''),
        to_char(coalesce(vi.issued_on, vi.created_at::date), 'DD Mon YYYY')
          || ' · '
          || upper(left(vi.id::text, 8))
      ) as reference,
      coalesce(nullif(btrim(p.name), ''), 'Operational') as project,
      coalesce(
        nullif(concat_ws(' · ', nullif(btrim(vi.description), ''), nullif(btrim(po.work_type), '')), ''),
        ''
      ) as detail,
      round(vi.amount, 2) as debit,
      0::numeric as credit
    from public.vendor_invoices vi
    join public.vendor_purchase_orders po on po.id = vi.purchase_order_id
    left join public.projects p on p.id = po.project_id
    left join lateral (
      select d.document_no
      from public.issued_documents d
      where d.purchase_order_id = po.id
        and d.kind = 'purchase_order'
      order by d.created_at desc
      limit 1
    ) po_doc on true
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
