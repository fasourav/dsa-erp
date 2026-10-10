-- Revert withheld-at-source VAT. The project value already includes VAT/Tax,
-- and that amount is split out on the client invoice. The linked row records
-- tax collected inside the invoice. It does not leave the bank. A VAT/Tax row
-- entered in the VAT/Tax module is still a real tax payment and a bank outflow.

CREATE OR REPLACE VIEW public.project_financials
WITH (security_invoker = true) AS
WITH client_paid AS (
  SELECT
    ci.project_id,
    (COALESCE(sum(cp.amount), 0))::numeric(14, 2) AS total_paid
  FROM public.client_invoices ci
  LEFT JOIN public.client_payments cp ON cp.client_invoice_id = ci.id
  WHERE ci.status <> 'void'::public.payment_status
  GROUP BY ci.project_id
),
po_committed AS (
  SELECT
    project_id,
    (COALESCE(sum(total_value), 0))::numeric(14, 2) AS committed_total
  FROM public.vendor_purchase_orders
  GROUP BY project_id
),
vendor_expense_paid AS (
  SELECT
    po.project_id,
    (COALESCE(sum(vp.amount), 0))::numeric(14, 2) AS paid_total
  FROM public.vendor_purchase_orders po
  LEFT JOIN public.vendor_invoices vi ON vi.purchase_order_id = po.id
  LEFT JOIN public.vendor_payments vp ON vp.vendor_invoice_id = vi.id
  GROUP BY po.project_id
),
operational_expense_paid AS (
  SELECT
    project_id,
    (COALESCE(sum(amount), 0))::numeric(14, 2) AS paid_total
  FROM public.operational_expenses
  WHERE project_id IS NOT NULL
  GROUP BY project_id
)
SELECT
  p.id AS project_id,
  p.name AS project_name,
  p.client_id,
  p.total_value,
  COALESCE(cp.total_paid, 0)::numeric(14, 2) AS total_paid,
  GREATEST(p.total_value - COALESCE(cp.total_paid, 0), 0)::numeric(14, 2) AS total_pending_due,
  (COALESCE(vep.paid_total, 0) + COALESCE(oep.paid_total, 0))::numeric(14, 2) AS expense_total,
  GREATEST(COALESCE(poc.committed_total, 0) - COALESCE(vep.paid_total, 0), 0)::numeric(14, 2) AS expense_due,
  (COALESCE(cp.total_paid, 0) - (COALESCE(vep.paid_total, 0) + COALESCE(oep.paid_total, 0)))::numeric(14, 2) AS gross_profit,
  CASE
    WHEN COALESCE(vep.paid_total, 0) + COALESCE(oep.paid_total, 0) > COALESCE(cp.total_paid, 0)
      THEN (COALESCE(vep.paid_total, 0) + COALESCE(oep.paid_total, 0) - COALESCE(cp.total_paid, 0))
    ELSE 0::numeric
  END::numeric(14, 2) AS backlog_amount
FROM public.projects p
LEFT JOIN client_paid cp ON cp.project_id = p.id
LEFT JOIN po_committed poc ON poc.project_id = p.id
LEFT JOIN vendor_expense_paid vep ON vep.project_id = p.id
LEFT JOIN operational_expense_paid oep ON oep.project_id = p.id;

CREATE OR REPLACE VIEW public.accounts_receivable
WITH (security_invoker = true) AS
SELECT
  ci.id,
  ci.due_on AS due_date,
  ci.status AS current_status,
  ci.project_id,
  p.name AS project_name,
  c.id AS client_id,
  COALESCE(c.person_name, c.company_name) AS client_name,
  ci.amount AS billed_amount,
  COALESCE(sum(cp.amount), 0::numeric)::numeric(14, 2) AS paid,
  GREATEST(
    ci.amount - COALESCE(sum(cp.amount), 0::numeric),
    0::numeric
  )::numeric(14, 2) AS due,
  ci.issued_on,
  ci.created_at
FROM public.client_invoices ci
JOIN public.projects p ON p.id = ci.project_id
JOIN public.clients c ON c.id = ci.client_id
LEFT JOIN public.client_payments cp ON cp.client_invoice_id = ci.id
WHERE ci.status <> 'void'::public.payment_status
GROUP BY ci.id, p.id, c.id;

ALTER VIEW public.project_financials SET (security_invoker = true);
ALTER VIEW public.accounts_receivable SET (security_invoker = true);

-- Rows created under the withheld model are not tax payments and have no invoice to attach to.
DELETE FROM public.vat_tax_payments WHERE withheld_at_source;

ALTER TABLE public.vat_tax_payments
  DROP CONSTRAINT IF EXISTS vat_tax_payments_withheld_link_check,
  DROP CONSTRAINT IF EXISTS vat_tax_payments_client_payment_id_key,
  DROP CONSTRAINT IF EXISTS vat_tax_payments_client_payment_id_fkey;

ALTER TABLE public.vat_tax_payments
  DROP COLUMN IF EXISTS client_payment_id,
  DROP COLUMN IF EXISTS withheld_at_source;

ALTER TABLE public.vat_tax_payments
  ADD COLUMN IF NOT EXISTS client_invoice_id uuid,
  ADD COLUMN IF NOT EXISTS collected_on_invoice boolean NOT NULL DEFAULT false;

ALTER TABLE public.vat_tax_payments
  DROP CONSTRAINT IF EXISTS vat_tax_payments_client_invoice_id_fkey;

ALTER TABLE public.vat_tax_payments
  ADD CONSTRAINT vat_tax_payments_client_invoice_id_fkey
  FOREIGN KEY (client_invoice_id) REFERENCES public.client_invoices (id) ON DELETE CASCADE;

ALTER TABLE public.vat_tax_payments
  DROP CONSTRAINT IF EXISTS vat_tax_payments_client_invoice_id_key;

ALTER TABLE public.vat_tax_payments
  ADD CONSTRAINT vat_tax_payments_client_invoice_id_key UNIQUE (client_invoice_id);

ALTER TABLE public.vat_tax_payments
  ALTER COLUMN bank_account_id DROP NOT NULL;

DROP TRIGGER IF EXISTS vat_tax_payments_assign_bank ON public.vat_tax_payments;

CREATE OR REPLACE FUNCTION public.assign_vat_tax_bank_account()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.collected_on_invoice THEN
    NEW.bank_account_id := NULL;
    RETURN NEW;
  END IF;

  NEW.bank_account_id := public.resolve_bank_account_id(NEW.bank_account_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER vat_tax_payments_assign_bank
  BEFORE INSERT OR UPDATE ON public.vat_tax_payments
  FOR EACH ROW EXECUTE FUNCTION public.assign_vat_tax_bank_account();

ALTER TABLE public.vat_tax_payments
  DROP CONSTRAINT IF EXISTS vat_tax_payments_collected_link_check;

ALTER TABLE public.vat_tax_payments
  ADD CONSTRAINT vat_tax_payments_collected_link_check
  CHECK (
    (
      collected_on_invoice
      AND client_invoice_id IS NOT NULL
      AND bank_account_id IS NULL
    )
    OR (
      NOT collected_on_invoice
      AND client_invoice_id IS NULL
      AND bank_account_id IS NOT NULL
    )
  );

COMMENT ON COLUMN public.vat_tax_payments.client_invoice_id IS
  'Client invoice this collected tax was split out of. Deleting the invoice deletes this row.';

COMMENT ON COLUMN public.vat_tax_payments.collected_on_invoice IS
  'True when this amount is the VAT/Tax portion of a client invoice. It is not a bank outflow.';

CREATE OR REPLACE FUNCTION public.sync_vat_tax_payment_bank_tx()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.collected_on_invoice THEN
    DELETE FROM public.bank_transactions WHERE vat_tax_payment_id = NEW.id;
    RETURN NEW;
  END IF;

  INSERT INTO public.bank_transactions (
    bank_account_id,
    direction,
    source_kind,
    transaction_date,
    amount,
    payment_method,
    vat_tax_payment_id,
    project_id,
    notes
  ) VALUES (
    NEW.bank_account_id,
    'outflow',
    'vat_tax',
    NEW.paid_on,
    NEW.amount,
    NEW.payment_method,
    NEW.id,
    NEW.project_id,
    NEW.notes
  )
  ON CONFLICT (vat_tax_payment_id) DO UPDATE SET
    bank_account_id = EXCLUDED.bank_account_id,
    direction = EXCLUDED.direction,
    source_kind = EXCLUDED.source_kind,
    transaction_date = EXCLUDED.transaction_date,
    amount = EXCLUDED.amount,
    payment_method = EXCLUDED.payment_method,
    project_id = EXCLUDED.project_id,
    notes = EXCLUDED.notes;

  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_vat_tax_bank_account() TO authenticated, service_role;
