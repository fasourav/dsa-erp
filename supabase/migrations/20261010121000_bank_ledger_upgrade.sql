-- Bank account details, a locked opening balance, payroll outflows, and
-- paired transfers. Manual deposits and withdrawals are ledger movements
-- only: they change the account balance and are not income or expense.
-- Transfers move money between accounts and are not income or expense.
-- A transfer's two lines share bank_transfers.id and are deleted together.

ALTER TABLE public.bank_accounts
  ADD COLUMN IF NOT EXISTS account_holder_name text,
  ADD COLUMN IF NOT EXISTS account_number text,
  ADD COLUMN IF NOT EXISTS routing_number text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS opening_balance numeric(14, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.bank_accounts
  DROP CONSTRAINT IF EXISTS bank_accounts_opening_balance_check;

ALTER TABLE public.bank_accounts
  ADD CONSTRAINT bank_accounts_opening_balance_check
  CHECK (opening_balance >= 0);

COMMENT ON COLUMN public.bank_accounts.account_holder_name IS
  'Legal account holder. Required when the account is created.';
COMMENT ON COLUMN public.bank_accounts.account_number IS
  'Account number. Required when the account is created.';
COMMENT ON COLUMN public.bank_accounts.routing_number IS
  'Routing number. Required when the account is created.';
COMMENT ON COLUMN public.bank_accounts.address IS
  'Bank or branch address. Required when the account is created.';
COMMENT ON COLUMN public.bank_accounts.opening_balance IS
  'Balance already in the account when it was added. Cannot be changed later. Account balance is opening balance plus inflows minus outflows.';

-- Existing accounts were created before these details existed, so they may
-- stay blank until edited. New accounts must include every detail.
CREATE OR REPLACE FUNCTION public.guard_bank_account()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF nullif(btrim(NEW.account_holder_name), '') IS NULL
      OR nullif(btrim(NEW.account_number), '') IS NULL
      OR nullif(btrim(NEW.bank_name), '') IS NULL
      OR nullif(btrim(NEW.routing_number), '') IS NULL
      OR nullif(btrim(NEW.address), '') IS NULL THEN
      RAISE EXCEPTION 'Account holder name, account number, bank name, routing number, and address are required.'
        USING ERRCODE = 'check_violation';
    END IF;
  ELSIF TG_OP = 'UPDATE'
    AND NEW.opening_balance IS DISTINCT FROM OLD.opening_balance THEN
    RAISE EXCEPTION 'Opening balance cannot be changed after the account is created.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bank_accounts_guard ON public.bank_accounts;
CREATE TRIGGER bank_accounts_guard
  BEFORE INSERT OR UPDATE ON public.bank_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_bank_account();

-- Do not invent an account. Payments wait until Settings has a real one.
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
  ORDER BY sort_order, created_at, id
  LIMIT 1;

  IF resolved IS NOT NULL THEN
    RETURN resolved;
  END IF;

  SELECT id INTO resolved
  FROM public.bank_accounts
  ORDER BY sort_order, created_at, id
  LIMIT 1;

  IF resolved IS NULL THEN
    RAISE EXCEPTION 'Add a bank account before recording this payment.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN resolved;
END;
$$;

CREATE TABLE IF NOT EXISTS public.company_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  fiscal_year_start_month smallint NOT NULL DEFAULT 7
    CHECK (fiscal_year_start_month BETWEEN 1 AND 12),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.company_settings (id, fiscal_year_start_month)
VALUES (true, 7)
ON CONFLICT (id) DO NOTHING;

COMMENT ON COLUMN public.company_settings.fiscal_year_start_month IS
  'Month the fiscal year starts. 7 is July, so FY 2025–26 runs 1 July 2025 through 30 June 2026. Bangladesh tax year stays 1 July–30 June even if this changes.';

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS company_settings_select ON public.company_settings;
CREATE POLICY company_settings_select ON public.company_settings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS company_settings_modify ON public.company_settings;
CREATE POLICY company_settings_modify ON public.company_settings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('owner', 'accountant')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('owner', 'accountant')
    )
  );

CREATE TABLE IF NOT EXISTS public.bank_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_account_id uuid NOT NULL REFERENCES public.bank_accounts (id) ON DELETE RESTRICT,
  to_account_id uuid NOT NULL REFERENCES public.bank_accounts (id) ON DELETE RESTRICT,
  amount numeric(14, 2) NOT NULL CHECK (amount > 0),
  transfer_date date NOT NULL,
  payment_method text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bank_transfers_distinct_accounts CHECK (from_account_id <> to_account_id)
);

COMMENT ON TABLE public.bank_transfers IS
  'Internal move between two accounts. Not income or expense. Deleting the transfer or either ledger line removes both lines.';

ALTER TABLE public.bank_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bank_transfers_select ON public.bank_transfers;
CREATE POLICY bank_transfers_select ON public.bank_transfers
  FOR SELECT USING (true);

DROP POLICY IF EXISTS bank_transfers_modify ON public.bank_transfers;
CREATE POLICY bank_transfers_modify ON public.bank_transfers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('owner', 'accountant')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('owner', 'accountant')
    )
  );

ALTER TABLE public.payroll_runs
  ADD COLUMN IF NOT EXISTS bank_account_id uuid,
  ADD COLUMN IF NOT EXISTS payment_method text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payroll_runs_bank_account_id_fkey'
  ) THEN
    ALTER TABLE public.payroll_runs
      ADD CONSTRAINT payroll_runs_bank_account_id_fkey
      FOREIGN KEY (bank_account_id) REFERENCES public.bank_accounts (id)
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS payroll_runs_bank_account_id_idx
  ON public.payroll_runs (bank_account_id);

ALTER TABLE public.bank_transactions
  ADD COLUMN IF NOT EXISTS payroll_line_id uuid,
  ADD COLUMN IF NOT EXISTS transfer_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bank_transactions_payroll_line_id_fkey'
  ) THEN
    ALTER TABLE public.bank_transactions
      ADD CONSTRAINT bank_transactions_payroll_line_id_fkey
      FOREIGN KEY (payroll_line_id) REFERENCES public.payroll_lines (id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bank_transactions_payroll_line_id_key'
  ) THEN
    ALTER TABLE public.bank_transactions
      ADD CONSTRAINT bank_transactions_payroll_line_id_key UNIQUE (payroll_line_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS bank_transactions_transfer_id_idx
  ON public.bank_transactions (transfer_id);

ALTER TABLE public.bank_transactions
  DROP CONSTRAINT IF EXISTS bank_tx_link_matches_source;

ALTER TABLE public.bank_transactions
  ADD CONSTRAINT bank_tx_link_matches_source CHECK (
    (
      source_kind = 'project_income'::public.bank_source_kind
      AND direction = 'inflow'::public.bank_flow_direction
      AND income_id IS NOT NULL
      AND vendor_payment_id IS NULL
      AND operational_expense_id IS NULL
      AND vat_tax_payment_id IS NULL
      AND payroll_line_id IS NULL
      AND transfer_id IS NULL
    )
    OR (
      source_kind = 'vendor_expense'::public.bank_source_kind
      AND direction = 'outflow'::public.bank_flow_direction
      AND vendor_payment_id IS NOT NULL
      AND income_id IS NULL
      AND operational_expense_id IS NULL
      AND vat_tax_payment_id IS NULL
      AND payroll_line_id IS NULL
      AND transfer_id IS NULL
    )
    OR (
      source_kind = 'operational_expense'::public.bank_source_kind
      AND direction = 'outflow'::public.bank_flow_direction
      AND operational_expense_id IS NOT NULL
      AND income_id IS NULL
      AND vendor_payment_id IS NULL
      AND vat_tax_payment_id IS NULL
      AND payroll_line_id IS NULL
      AND transfer_id IS NULL
    )
    OR (
      source_kind = 'vat_tax'::public.bank_source_kind
      AND direction = 'outflow'::public.bank_flow_direction
      AND vat_tax_payment_id IS NOT NULL
      AND income_id IS NULL
      AND vendor_payment_id IS NULL
      AND operational_expense_id IS NULL
      AND payroll_line_id IS NULL
      AND transfer_id IS NULL
    )
    OR (
      source_kind = 'other'::public.bank_source_kind
      AND income_id IS NULL
      AND vendor_payment_id IS NULL
      AND operational_expense_id IS NULL
      AND vat_tax_payment_id IS NULL
      AND payroll_line_id IS NULL
      AND transfer_id IS NULL
    )
    OR (
      source_kind = 'payroll'::public.bank_source_kind
      AND direction = 'outflow'::public.bank_flow_direction
      AND payroll_line_id IS NOT NULL
      AND income_id IS NULL
      AND vendor_payment_id IS NULL
      AND operational_expense_id IS NULL
      AND vat_tax_payment_id IS NULL
      AND transfer_id IS NULL
    )
    OR (
      source_kind = 'transfer'::public.bank_source_kind
      AND transfer_id IS NOT NULL
      AND income_id IS NULL
      AND vendor_payment_id IS NULL
      AND operational_expense_id IS NULL
      AND vat_tax_payment_id IS NULL
      AND payroll_line_id IS NULL
    )
    OR (
      source_kind = 'deposit'::public.bank_source_kind
      AND direction = 'inflow'::public.bank_flow_direction
      AND income_id IS NULL
      AND vendor_payment_id IS NULL
      AND operational_expense_id IS NULL
      AND vat_tax_payment_id IS NULL
      AND payroll_line_id IS NULL
      AND transfer_id IS NULL
    )
    OR (
      source_kind = 'withdrawal'::public.bank_source_kind
      AND direction = 'outflow'::public.bank_flow_direction
      AND income_id IS NULL
      AND vendor_payment_id IS NULL
      AND operational_expense_id IS NULL
      AND vat_tax_payment_id IS NULL
      AND payroll_line_id IS NULL
      AND transfer_id IS NULL
    )
  );

-- Paid payroll posts one outflow per line. Draft and approved runs do not.
-- Editing or deleting a line, or leaving Paid, keeps the ledger in step.
CREATE OR REPLACE FUNCTION public.assign_payroll_bank_account()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'paid' THEN
    NEW.bank_account_id := public.resolve_bank_account_id(NEW.bank_account_id);
    IF NEW.paid_on IS NULL THEN
      NEW.paid_on := make_date(NEW.period_year, NEW.period_month, 1);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_payroll_line_bank_tx(line_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  line public.payroll_lines%ROWTYPE;
  run public.payroll_runs%ROWTYPE;
  emp_name text;
  pay_date date;
  note text;
BEGIN
  SELECT * INTO line FROM public.payroll_lines WHERE id = line_id;
  IF NOT FOUND THEN
    DELETE FROM public.bank_transactions WHERE payroll_line_id = line_id;
    RETURN;
  END IF;

  SELECT * INTO run FROM public.payroll_runs WHERE id = line.payroll_run_id;

  IF NOT FOUND
    OR run.status IS DISTINCT FROM 'paid'
    OR line.net_salary IS NULL
    OR line.net_salary <= 0
    OR run.bank_account_id IS NULL THEN
    DELETE FROM public.bank_transactions WHERE payroll_line_id = line.id;
    RETURN;
  END IF;

  pay_date := COALESCE(run.paid_on, make_date(run.period_year, run.period_month, 1));

  SELECT full_name INTO emp_name
  FROM public.employees
  WHERE id = line.employee_id;

  note := 'Salary · ' || COALESCE(nullif(btrim(emp_name), ''), 'Employee');
  IF line.notes IS NOT NULL AND btrim(line.notes) <> '' THEN
    note := note || ' · ' || btrim(line.notes);
  END IF;

  INSERT INTO public.bank_transactions (
    bank_account_id,
    direction,
    source_kind,
    transaction_date,
    amount,
    payment_method,
    payroll_line_id,
    notes
  ) VALUES (
    run.bank_account_id,
    'outflow',
    'payroll',
    pay_date,
    line.net_salary,
    run.payment_method,
    line.id,
    note
  )
  ON CONFLICT (payroll_line_id) DO UPDATE SET
    bank_account_id = EXCLUDED.bank_account_id,
    direction = EXCLUDED.direction,
    source_kind = EXCLUDED.source_kind,
    transaction_date = EXCLUDED.transaction_date,
    amount = EXCLUDED.amount,
    payment_method = EXCLUDED.payment_method,
    notes = EXCLUDED.notes;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_payroll_line_bank_tx()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.upsert_payroll_line_bank_tx(NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_payroll_run_bank_tx()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  line_id uuid;
BEGIN
  IF NEW.status IS DISTINCT FROM 'paid' THEN
    DELETE FROM public.bank_transactions
    WHERE payroll_line_id IN (
      SELECT id FROM public.payroll_lines WHERE payroll_run_id = NEW.id
    );
    RETURN NEW;
  END IF;

  FOR line_id IN
    SELECT id FROM public.payroll_lines WHERE payroll_run_id = NEW.id
  LOOP
    PERFORM public.upsert_payroll_line_bank_tx(line_id);
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payroll_runs_assign_bank ON public.payroll_runs;
CREATE TRIGGER payroll_runs_assign_bank
  BEFORE INSERT OR UPDATE ON public.payroll_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_payroll_bank_account();

DROP TRIGGER IF EXISTS payroll_runs_sync_bank ON public.payroll_runs;
CREATE TRIGGER payroll_runs_sync_bank
  AFTER INSERT OR UPDATE ON public.payroll_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_payroll_run_bank_tx();

DROP TRIGGER IF EXISTS payroll_lines_sync_bank ON public.payroll_lines;
CREATE TRIGGER payroll_lines_sync_bank
  AFTER INSERT OR UPDATE ON public.payroll_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_payroll_line_bank_tx();

-- Transfer lines are written from the transfer row so the pair cannot drift.
CREATE OR REPLACE FUNCTION public.sync_transfer_legs()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.bank_transactions (
      bank_account_id,
      direction,
      source_kind,
      transaction_date,
      amount,
      payment_method,
      notes,
      transfer_id
    ) VALUES
      (
        NEW.from_account_id,
        'outflow',
        'transfer',
        NEW.transfer_date,
        NEW.amount,
        NEW.payment_method,
        NEW.notes,
        NEW.id
      ),
      (
        NEW.to_account_id,
        'inflow',
        'transfer',
        NEW.transfer_date,
        NEW.amount,
        NEW.payment_method,
        NEW.notes,
        NEW.id
      );
    RETURN NEW;
  END IF;

  UPDATE public.bank_transactions
  SET
    bank_account_id = NEW.from_account_id,
    transaction_date = NEW.transfer_date,
    amount = NEW.amount,
    payment_method = NEW.payment_method,
    notes = NEW.notes
  WHERE transfer_id = NEW.id
    AND direction = 'outflow';

  UPDATE public.bank_transactions
  SET
    bank_account_id = NEW.to_account_id,
    transaction_date = NEW.transfer_date,
    amount = NEW.amount,
    payment_method = NEW.payment_method,
    notes = NEW.notes
  WHERE transfer_id = NEW.id
    AND direction = 'inflow';

  RETURN NEW;
END;
$$;

-- A session flag stops the pair of delete triggers from calling each other.
-- Deleting either ledger line deletes the transfer, which removes the other line.
CREATE OR REPLACE FUNCTION public.delete_transfer_legs()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF current_setting('dsa.deleting_transfer', true) = '1' THEN
    RETURN OLD;
  END IF;

  PERFORM set_config('dsa.deleting_transfer', '1', true);
  DELETE FROM public.bank_transactions WHERE transfer_id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_transfer_from_leg()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.transfer_id IS NULL
    OR current_setting('dsa.deleting_transfer', true) = '1' THEN
    RETURN OLD;
  END IF;

  PERFORM set_config('dsa.deleting_transfer', '1', true);
  DELETE FROM public.bank_transactions
  WHERE transfer_id = OLD.transfer_id
    AND id <> OLD.id;
  DELETE FROM public.bank_transfers WHERE id = OLD.transfer_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS bank_transfers_sync_legs ON public.bank_transfers;
CREATE TRIGGER bank_transfers_sync_legs
  AFTER INSERT OR UPDATE ON public.bank_transfers
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_transfer_legs();

DROP TRIGGER IF EXISTS bank_transfers_delete_legs ON public.bank_transfers;
CREATE TRIGGER bank_transfers_delete_legs
  BEFORE DELETE ON public.bank_transfers
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_transfer_legs();

DROP TRIGGER IF EXISTS bank_transactions_delete_transfer ON public.bank_transactions;
CREATE TRIGGER bank_transactions_delete_transfer
  BEFORE DELETE ON public.bank_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_transfer_from_leg();

GRANT EXECUTE ON FUNCTION public.guard_bank_account() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.assign_payroll_bank_account() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_payroll_line_bank_tx(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_payroll_line_bank_tx() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_payroll_run_bank_tx() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_transfer_legs() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_transfer_legs() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_transfer_from_leg() TO authenticated, service_role;

GRANT SELECT, UPDATE ON public.company_settings TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_transfers TO authenticated, service_role;

-- Runs already marked paid get ledger lines on the default account.
UPDATE public.payroll_runs
SET status = status
WHERE status = 'paid';
