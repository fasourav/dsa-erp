-- Accounts Payable shows the purchase order work category beside the vendor
-- name. accounts_payable keeps its current columns and appends work_type from
-- vendor_purchase_orders. security_invoker stays on so the view still follows
-- RLS on the underlying tables.
--
-- Safe to run more than once.

CREATE OR REPLACE VIEW public.accounts_payable
WITH (security_invoker = true) AS
SELECT
  po.id,
  due.due_date,
  CASE
    WHEN po.total_value > 0::numeric
      AND COALESCE(paid.total_paid, 0::numeric) >= po.total_value
      THEN 'paid'::public.payment_status
    WHEN COALESCE(paid.total_paid, 0::numeric) > 0::numeric
      THEN 'partial'::public.payment_status
    ELSE 'unpaid'::public.payment_status
  END AS current_status,
  po.id AS purchase_order_id,
  po.project_id,
  p.name AS project_name,
  v.id AS vendor_id,
  COALESCE(v.person_name, v.company_name) AS vendor_name,
  po.total_value AS total_payable,
  COALESCE(paid.total_paid, 0::numeric)::numeric(14, 2) AS total_paid,
  GREATEST(po.total_value - COALESCE(paid.total_paid, 0::numeric), 0::numeric)::numeric(14, 2) AS pending_payable,
  po.issued_on,
  po.created_at,
  v.vendor_field,
  po.work_type
FROM public.vendor_purchase_orders po
JOIN public.projects p ON p.id = po.project_id
JOIN public.vendors v ON v.id = po.vendor_id
LEFT JOIN LATERAL (
  SELECT COALESCE(sum(vp.amount), 0::numeric) AS total_paid
  FROM public.vendor_invoices vi
  JOIN public.vendor_payments vp ON vp.vendor_invoice_id = vi.id
  WHERE vi.purchase_order_id = po.id
) paid ON true
LEFT JOIN LATERAL (
  SELECT min(vi.due_on) AS due_date
  FROM public.vendor_invoices vi
  WHERE vi.purchase_order_id = po.id
    AND vi.status <> 'void'::public.payment_status
    AND vi.due_on IS NOT NULL
    AND COALESCE((
      SELECT sum(vp.amount)
      FROM public.vendor_payments vp
      WHERE vp.vendor_invoice_id = vi.id
    ), 0::numeric) < vi.amount
) due ON true;

ALTER VIEW public.accounts_payable SET (security_invoker = true);
