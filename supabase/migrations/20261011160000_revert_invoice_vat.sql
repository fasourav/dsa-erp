-- Return VAT/Tax to manual payments entered against a project.
-- The withheld and invoice-collected migrations stay in history.
-- Delete only rows this feature created, then drop the invoice link.

DELETE FROM public.vat_tax_payments
WHERE collected_on_invoice
  AND client_invoice_id IS NOT NULL
  AND bank_account_id IS NULL
  AND notes = 'Collected on client invoice';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.vat_tax_payments
    WHERE collected_on_invoice
       OR client_invoice_id IS NOT NULL
       OR bank_account_id IS NULL
  ) THEN
    RAISE EXCEPTION 'A VAT/Tax row still uses the invoice link or has no bank account.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.sync_vat_tax_payment_bank_tx()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
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

ALTER TABLE public.vat_tax_payments
  DROP CONSTRAINT IF EXISTS vat_tax_payments_collected_link_check;

DROP TRIGGER IF EXISTS vat_tax_payments_assign_bank ON public.vat_tax_payments;

CREATE TRIGGER vat_tax_payments_assign_bank
  BEFORE INSERT OR UPDATE ON public.vat_tax_payments
  FOR EACH ROW EXECUTE FUNCTION public.assign_bank_account();

DROP FUNCTION IF EXISTS public.assign_vat_tax_bank_account();

ALTER TABLE public.vat_tax_payments
  DROP CONSTRAINT IF EXISTS vat_tax_payments_client_invoice_id_key,
  DROP CONSTRAINT IF EXISTS vat_tax_payments_client_invoice_id_fkey;

ALTER TABLE public.vat_tax_payments
  DROP COLUMN IF EXISTS client_invoice_id,
  DROP COLUMN IF EXISTS collected_on_invoice;

ALTER TABLE public.vat_tax_payments
  ALTER COLUMN bank_account_id SET NOT NULL;
