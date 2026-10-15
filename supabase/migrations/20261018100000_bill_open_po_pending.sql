-- P-03. Purchase-order pending matches bill-based accounts payable.
-- Not applied by the app. Apply it with the normal migration flow.
-- total_value stays the purchase-order commitment.
-- total_paid stays payments on non-void bills.
-- total_pending becomes the sum of each non-void bill's unpaid balance.
-- An overpayment on one bill does not reduce another.
-- Void bills are excluded.
-- vendor_summaries.total_due sums this pending figure and picks the change up.
-- Client AR (project_financials.total_pending_due) is unchanged.
-- project_financials.expense_due stays commitment minus payments. The projects
-- list shows that column as Expense Due, not Payable. Project Payable is the
-- bill-open figure computed in the app.

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
          then coalesce(paid.total_paid, 0)
        else null
      end)::numeric(14, 2) as total_paid,
      (case
        when private.can('vendor_payments', 'view') and private.sees_financials()
          then coalesce(open_bills.total_pending, 0)
        else null
      end)::numeric(14, 2) as total_pending
    from public.vendor_purchase_orders po
    left join (
      select
        vi.purchase_order_id,
        coalesce(sum(vp.amount), 0)::numeric(14, 2) as total_paid
      from public.vendor_invoices vi
      join public.vendor_payments vp on vp.vendor_invoice_id = vi.id
      where vi.status is distinct from 'void'::public.payment_status
      group by vi.purchase_order_id
    ) paid on paid.purchase_order_id = po.id
    left join (
      select
        bill.purchase_order_id,
        coalesce(sum(greatest(bill.amount - bill.paid, 0)), 0)::numeric(14, 2) as total_pending
      from (
        select
          vi.purchase_order_id,
          vi.amount,
          coalesce(sum(vp.amount), 0) as paid
        from public.vendor_invoices vi
        left join public.vendor_payments vp on vp.vendor_invoice_id = vi.id
        where vi.status is distinct from 'void'::public.payment_status
        group by vi.id
      ) bill
      group by bill.purchase_order_id
    ) open_bills on open_bills.purchase_order_id = po.id
    where private.can('purchase_orders', 'view')
       or private.can('vendor_payments', 'view')
       or private.can('accounts_payable', 'view')
       or private.can('expense', 'view')
       or private.can('dashboard', 'view')
  ) s
  where private.can('purchase_orders', 'view');
$$;

revoke all on function private.vendor_po_balance_rows() from public, anon;
grant execute on function private.vendor_po_balance_rows() to authenticated, service_role;

comment on function private.vendor_po_balance_rows() is
  'Purchase-order balances. total_value is the order commitment. total_paid is payments on non-void bills. total_pending is the sum of each non-void bill open balance, matching accounts payable. Void bills are excluded.';

notify pgrst, 'reload schema';
