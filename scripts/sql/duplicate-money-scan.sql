-- Read-only scan for likely duplicate outflows.
-- Same amount, same bank account, dates within 7 days, across
-- operational_expenses, vendor_payments, and bank_transactions.
-- A source row and the bank line it posted are not reported as a pair.
-- One real duplicate can appear as more than one pair: the two sources, and each source against the other source's bank line.
-- Does not update or delete anything. Not a pgTAP test.
-- Run in the SQL editor.

with events as (
  select
    'Operational Expense'::text as kind,
    oe.id::text as source_key,
    oe.expense_date as event_date,
    oe.amount,
    oe.bank_account_id,
    coalesce(
      nullif(btrim(v.company_name), ''),
      nullif(btrim(v.person_name), ''),
      nullif(btrim(oe.category), ''),
      '—'
    ) as label,
    oe.id as expense_id,
    null::uuid as payment_id
  from public.operational_expenses oe
  left join public.vendors v on v.id = oe.vendor_id

  union all

  select
    'Vendor Payment',
    vp.id::text,
    vp.paid_on,
    vp.amount,
    vp.bank_account_id,
    coalesce(
      nullif(btrim(v.company_name), ''),
      nullif(btrim(v.person_name), ''),
      nullif(btrim(vp.expense_category), ''),
      '—'
    ),
    null::uuid,
    vp.id
  from public.vendor_payments vp
  join public.vendor_invoices vi on vi.id = vp.vendor_invoice_id
  join public.vendor_purchase_orders po on po.id = vi.purchase_order_id
  left join public.vendors v on v.id = po.vendor_id

  union all

  select
    'Bank Line',
    bt.id::text,
    bt.transaction_date,
    bt.amount,
    bt.bank_account_id,
    bt.source_kind::text,
    bt.operational_expense_id,
    bt.vendor_payment_id
  from public.bank_transactions bt
  where bt.direction = 'outflow'
    and bt.bank_account_id is not null
    and bt.amount is not null
)
select
  a.kind as left_kind,
  a.event_date as left_date,
  a.label as left_label,
  a.amount,
  ba.name as bank_account,
  b.kind as right_kind,
  b.event_date as right_date,
  b.label as right_label,
  (b.event_date - a.event_date) as day_gap
from events a
join events b
  on a.bank_account_id = b.bank_account_id
 and a.amount = b.amount
 and a.source_key < b.source_key
 and abs(b.event_date - a.event_date) <= 7
join public.bank_accounts ba on ba.id = a.bank_account_id
where not (
  (a.expense_id is not null and a.expense_id = b.expense_id)
  or (a.payment_id is not null and a.payment_id = b.payment_id)
)
order by a.event_date desc, a.amount desc, a.source_key, b.source_key;
