-- Operational purchase orders are vendor POs that do not belong to a project.
-- Existing project purchase orders keep their project_id.
ALTER TABLE public.vendor_purchase_orders
  ALTER COLUMN project_id DROP NOT NULL;

COMMENT ON COLUMN public.vendor_purchase_orders.project_id IS
  'Null when the purchase order is operational spending and does not belong to a project.';
