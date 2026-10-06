-- Accounts payable is the purchase order obligation (PO amount minus payments),
-- so a PO shows up as soon as it is assigned. Vendor invoices and payments stay
-- the settlement chain. Cash that actually moves (client payments in, vendor
-- payments and operational expenses out, VAT payments out) is mirrored into
-- bank_transactions and kept in sync on edit and delete.
--
-- bank_transactions.income_id references client_payments.id. The income view's
-- income_id is that same client payment id.

ALTER TABLE public.client_payments
  ADD COLUMN IF NOT EXISTS bank_account_id uuid;

ALTER TABLE public.vendor_payments
  ADD COLUMN IF NOT EXISTS bank_account_id uuid;

ALTER TABLE public.operational_expenses
  ADD COLUMN IF NOT EXISTS bank_account_id uuid;

ALTER TABLE public.vat_tax_payments
  ADD COLUMN IF NOT EXISTS bank_account_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'client_payments_bank_account_id_fkey'
  ) THEN
    ALTER TABLE public.client_payments
      ADD CONSTRAINT client_payments_bank_account_id_fkey
      FOREIGN KEY (bank_account_id) REFERENCES public.bank_accounts (id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'vendor_payments_bank_account_id_fkey'
  ) THEN
    ALTER TABLE public.vendor_payments
      ADD CONSTRAINT vendor_payments_bank_account_id_fkey
      FOREIGN KEY (bank_account_id) REFERENCES public.bank_accounts (id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'operational_expenses_bank_account_id_fkey'
  ) THEN
    ALTER TABLE public.operational_expenses
      ADD CONSTRAINT operational_expenses_bank_account_id_fkey
      FOREIGN KEY (bank_account_id) REFERENCES public.bank_accounts (id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'vat_tax_payments_bank_account_id_fkey'
  ) THEN
    ALTER TABLE public.vat_tax_payments
      ADD CONSTRAINT vat_tax_payments_bank_account_id_fkey
      FOREIGN KEY (bank_account_id) REFERENCES public.bank_accounts (id)
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS client_payments_bank_account_id_idx
  ON public.client_payments (bank_account_id);

CREATE INDEX IF NOT EXISTS vendor_payments_bank_account_id_idx
  ON public.vendor_payments (bank_account_id);

CREATE INDEX IF NOT EXISTS operational_expenses_bank_account_id_idx
  ON public.operational_expenses (bank_account_id);

CREATE INDEX IF NOT EXISTS vat_tax_payments_bank_account_id_idx
  ON public.vat_tax_payments (bank_account_id);

-- One ledger row per source payment. Nullable uniques still allow many manual
-- "other" rows, which leave every source id null.
ALTER TABLE public.bank_transactions
  DROP CONSTRAINT IF EXISTS bank_transactions_income_id_key;
ALTER TABLE public.bank_transactions
  ADD CONSTRAINT bank_transactions_income_id_key UNIQUE (income_id);

ALTER TABLE public.bank_transactions
  DROP CONSTRAINT IF EXISTS bank_transactions_vendor_payment_id_key;
ALTER TABLE public.bank_transactions
  ADD CONSTRAINT bank_transactions_vendor_payment_id_key UNIQUE (vendor_payment_id);

ALTER TABLE public.bank_transactions
  DROP CONSTRAINT IF EXISTS bank_transactions_operational_expense_id_key;
ALTER TABLE public.bank_transactions
  ADD CONSTRAINT bank_transactions_operational_expense_id_key UNIQUE (operational_expense_id);

ALTER TABLE public.bank_transactions
  DROP CONSTRAINT IF EXISTS bank_transactions_vat_tax_payment_id_key;
ALTER TABLE public.bank_transactions
  ADD CONSTRAINT bank_transactions_vat_tax_payment_id_key UNIQUE (vat_tax_payment_id);

-- Deleting the source payment removes its ledger row. SET NULL used to violate
-- bank_tx_link_matches_source, so those deletes failed once a bank row existed.
ALTER TABLE public.bank_transactions
  DROP CONSTRAINT bank_transactions_income_id_fkey;
ALTER TABLE public.bank_transactions
  ADD CONSTRAINT bank_transactions_income_id_fkey
  FOREIGN KEY (income_id) REFERENCES public.client_payments (id) ON DELETE CASCADE;

ALTER TABLE public.bank_transactions
  DROP CONSTRAINT bank_transactions_vendor_payment_id_fkey;
ALTER TABLE public.bank_transactions
  ADD CONSTRAINT bank_transactions_vendor_payment_id_fkey
  FOREIGN KEY (vendor_payment_id) REFERENCES public.vendor_payments (id) ON DELETE CASCADE;

ALTER TABLE public.bank_transactions
  DROP CONSTRAINT bank_transactions_operational_expense_id_fkey;
ALTER TABLE public.bank_transactions
  ADD CONSTRAINT bank_transactions_operational_expense_id_fkey
  FOREIGN KEY (operational_expense_id) REFERENCES public.operational_expenses (id) ON DELETE CASCADE;

ALTER TABLE public.bank_transactions
  DROP CONSTRAINT bank_transactions_vat_tax_payment_id_fkey;
ALTER TABLE public.bank_transactions
  ADD CONSTRAINT bank_transactions_vat_tax_payment_id_fkey
  FOREIGN KEY (vat_tax_payment_id) REFERENCES public.vat_tax_payments (id) ON DELETE CASCADE;

ALTER TABLE public.bank_transactions
  DROP CONSTRAINT bank_tx_link_matches_source;

ALTER TABLE public.bank_transactions
  ADD CONSTRAINT bank_tx_link_matches_source CHECK (
    (
      source_kind = 'project_income'::public.bank_source_kind
      AND direction = 'inflow'::public.bank_flow_direction
      AND income_id IS NOT NULL
      AND vendor_payment_id IS NULL
      AND operational_expense_id IS NULL
      AND vat_tax_payment_id IS NULL
    )
    OR (
      source_kind = 'vendor_expense'::public.bank_source_kind
      AND direction = 'outflow'::public.bank_flow_direction
      AND vendor_payment_id IS NOT NULL
      AND income_id IS NULL
      AND operational_expense_id IS NULL
      AND vat_tax_payment_id IS NULL
    )
    OR (
      source_kind = 'operational_expense'::public.bank_source_kind
      AND direction = 'outflow'::public.bank_flow_direction
      AND operational_expense_id IS NOT NULL
      AND income_id IS NULL
      AND vendor_payment_id IS NULL
      AND vat_tax_payment_id IS NULL
    )
    OR (
      source_kind = 'vat_tax'::public.bank_source_kind
      AND direction = 'outflow'::public.bank_flow_direction
      AND vat_tax_payment_id IS NOT NULL
      AND income_id IS NULL
      AND vendor_payment_id IS NULL
      AND operational_expense_id IS NULL
    )
    OR (
      source_kind = 'other'::public.bank_source_kind
      AND income_id IS NULL
      AND vendor_payment_id IS NULL
      AND operational_expense_id IS NULL
      AND vat_tax_payment_id IS NULL
    )
  );

COMMENT ON COLUMN public.bank_transactions.income_id IS
  'Client payment for this inflow. Same id as income.income_id (client_payments.id).';

CREATE OR REPLACE FUNCTION public.resolve_bank_account_id(preferred uuid)
RETURNS uuid
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  resolved uuid;
BEGIN
  IF preferred IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.bank_accounts WHERE id = preferred
  ) THEN
    RETURN preferred;
  END IF;

  SELECT id INTO resolved
  FROM public.bank_accounts
  WHERE is_active
  ORDER BY created_at, id
  LIMIT 1;

  IF resolved IS NOT NULL THEN
    RETURN resolved;
  END IF;

  SELECT id INTO resolved
  FROM public.bank_accounts
  ORDER BY created_at, id
  LIMIT 1;

  IF resolved IS NOT NULL THEN
    RETURN resolved;
  END IF;

  INSERT INTO public.bank_accounts (name, currency, is_active)
  VALUES ('Operating account', 'BDT', true)
  RETURNING id INTO resolved;

  RETURN resolved;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_bank_account()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.bank_account_id := public.resolve_bank_account_id(NEW.bank_account_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_client_payment_bank_tx()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  project uuid;
BEGIN
  SELECT ci.project_id INTO project
  FROM public.client_invoices ci
  WHERE ci.id = NEW.client_invoice_id;

  INSERT INTO public.bank_transactions (
    bank_account_id,
    direction,
    source_kind,
    transaction_date,
    amount,
    payment_method,
    income_id,
    project_id,
    notes
  ) VALUES (
    NEW.bank_account_id,
    'inflow',
    'project_income',
    NEW.paid_on,
    NEW.amount,
    NEW.method,
    NEW.id,
    project,
    COALESCE(NEW.remarks, NEW.notes)
  )
  ON CONFLICT (income_id) DO UPDATE SET
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

CREATE OR REPLACE FUNCTION public.sync_vendor_payment_bank_tx()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  project uuid;
BEGIN
  SELECT po.project_id INTO project
  FROM public.vendor_invoices vi
  JOIN public.vendor_purchase_orders po ON po.id = vi.purchase_order_id
  WHERE vi.id = NEW.vendor_invoice_id;

  INSERT INTO public.bank_transactions (
    bank_account_id,
    direction,
    source_kind,
    transaction_date,
    amount,
    payment_method,
    vendor_payment_id,
    project_id,
    notes
  ) VALUES (
    NEW.bank_account_id,
    'outflow',
    'vendor_expense',
    NEW.paid_on,
    NEW.amount,
    NEW.method,
    NEW.id,
    project,
    NEW.notes
  )
  ON CONFLICT (vendor_payment_id) DO UPDATE SET
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

CREATE OR REPLACE FUNCTION public.sync_operational_expense_bank_tx()
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
    operational_expense_id,
    project_id,
    notes
  ) VALUES (
    NEW.bank_account_id,
    'outflow',
    'operational_expense',
    NEW.expense_date,
    NEW.amount,
    NEW.payment_method,
    NEW.id,
    NEW.project_id,
    NEW.notes
  )
  ON CONFLICT (operational_expense_id) DO UPDATE SET
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

DROP TRIGGER IF EXISTS client_payments_assign_bank ON public.client_payments;
CREATE TRIGGER client_payments_assign_bank
  BEFORE INSERT OR UPDATE ON public.client_payments
  FOR EACH ROW EXECUTE FUNCTION public.assign_bank_account();

DROP TRIGGER IF EXISTS client_payments_sync_bank ON public.client_payments;
CREATE TRIGGER client_payments_sync_bank
  AFTER INSERT OR UPDATE ON public.client_payments
  FOR EACH ROW EXECUTE FUNCTION public.sync_client_payment_bank_tx();

DROP TRIGGER IF EXISTS vendor_payments_assign_bank ON public.vendor_payments;
CREATE TRIGGER vendor_payments_assign_bank
  BEFORE INSERT OR UPDATE ON public.vendor_payments
  FOR EACH ROW EXECUTE FUNCTION public.assign_bank_account();

DROP TRIGGER IF EXISTS vendor_payments_sync_bank ON public.vendor_payments;
CREATE TRIGGER vendor_payments_sync_bank
  AFTER INSERT OR UPDATE ON public.vendor_payments
  FOR EACH ROW EXECUTE FUNCTION public.sync_vendor_payment_bank_tx();

DROP TRIGGER IF EXISTS operational_expenses_assign_bank ON public.operational_expenses;
CREATE TRIGGER operational_expenses_assign_bank
  BEFORE INSERT OR UPDATE ON public.operational_expenses
  FOR EACH ROW EXECUTE FUNCTION public.assign_bank_account();

DROP TRIGGER IF EXISTS operational_expenses_sync_bank ON public.operational_expenses;
CREATE TRIGGER operational_expenses_sync_bank
  AFTER INSERT OR UPDATE ON public.operational_expenses
  FOR EACH ROW EXECUTE FUNCTION public.sync_operational_expense_bank_tx();

DROP TRIGGER IF EXISTS vat_tax_payments_assign_bank ON public.vat_tax_payments;
CREATE TRIGGER vat_tax_payments_assign_bank
  BEFORE INSERT OR UPDATE ON public.vat_tax_payments
  FOR EACH ROW EXECUTE FUNCTION public.assign_bank_account();

DROP TRIGGER IF EXISTS vat_tax_payments_sync_bank ON public.vat_tax_payments;
CREATE TRIGGER vat_tax_payments_sync_bank
  AFTER INSERT OR UPDATE ON public.vat_tax_payments
  FOR EACH ROW EXECUTE FUNCTION public.sync_vat_tax_payment_bank_tx();

GRANT EXECUTE ON FUNCTION public.resolve_bank_account_id(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.assign_bank_account() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_client_payment_bank_tx() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_vendor_payment_bank_tx() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_operational_expense_bank_tx() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_vat_tax_payment_bank_tx() TO authenticated, service_role;

-- Existing money rows get a ledger entry. This sets bank_account_id on those
-- rows (creating Operating account when none exists) and does not change amounts.
UPDATE public.client_payments
SET bank_account_id = public.resolve_bank_account_id(bank_account_id);

UPDATE public.vendor_payments
SET bank_account_id = public.resolve_bank_account_id(bank_account_id);

UPDATE public.operational_expenses
SET bank_account_id = public.resolve_bank_account_id(bank_account_id);

UPDATE public.vat_tax_payments
SET bank_account_id = public.resolve_bank_account_id(bank_account_id);

ALTER TABLE public.client_payments
  ALTER COLUMN bank_account_id SET NOT NULL;

ALTER TABLE public.vendor_payments
  ALTER COLUMN bank_account_id SET NOT NULL;

ALTER TABLE public.operational_expenses
  ALTER COLUMN bank_account_id SET NOT NULL;

ALTER TABLE public.vat_tax_payments
  ALTER COLUMN bank_account_id SET NOT NULL;

CREATE OR REPLACE VIEW public.accounts_payable AS
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
  v.vendor_field
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
