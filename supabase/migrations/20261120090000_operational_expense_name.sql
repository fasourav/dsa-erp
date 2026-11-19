-- v1.4.4: Operational Expenses get a short "Expense Name".
-- 1) New optional column public.operational_expenses.name (trimmed 1-120 chars).
--    Optional in the database so the existing rows stay valid; the app requires it on every save.
-- 2) The bank sync trigger now writes "Name — Notes" into the linked bank entry's notes
--    (capped at the bank notes limit of 1000 characters; empty stays NULL).
-- No data is rewritten. Existing bank entries change only when their expense is next saved.
-- CREATE OR REPLACE keeps the function's owner, grants, SECURITY DEFINER and search_path.
--
-- Rollback (restores the exact pre-v1.4.4 state):
--   CREATE OR REPLACE FUNCTION public.sync_operational_expense_bank_tx()
--    RETURNS trigger
--    LANGUAGE plpgsql
--    SECURITY DEFINER
--    SET search_path TO 'public'
--   AS $function$
--   BEGIN
--     INSERT INTO public.bank_transactions (
--       bank_account_id, direction, source_kind, transaction_date, amount,
--       payment_method, operational_expense_id, project_id, notes
--     ) VALUES (
--       NEW.bank_account_id, 'outflow', 'operational_expense', NEW.expense_date, NEW.amount,
--       NEW.payment_method, NEW.id, NEW.project_id, NEW.notes
--     )
--     ON CONFLICT (operational_expense_id) DO UPDATE SET
--       bank_account_id = EXCLUDED.bank_account_id,
--       direction = EXCLUDED.direction,
--       source_kind = EXCLUDED.source_kind,
--       transaction_date = EXCLUDED.transaction_date,
--       amount = EXCLUDED.amount,
--       payment_method = EXCLUDED.payment_method,
--       project_id = EXCLUDED.project_id,
--       notes = EXCLUDED.notes;
--
--     RETURN NEW;
--   END;
--   $function$;
--   ALTER TABLE public.operational_expenses DROP CONSTRAINT IF EXISTS operational_expenses_name_len;
--   ALTER TABLE public.operational_expenses DROP COLUMN IF EXISTS name;

ALTER TABLE public.operational_expenses
  ADD COLUMN IF NOT EXISTS name text;

ALTER TABLE public.operational_expenses
  DROP CONSTRAINT IF EXISTS operational_expenses_name_len;

ALTER TABLE public.operational_expenses
  ADD CONSTRAINT operational_expenses_name_len
  CHECK (name IS NULL OR char_length(btrim(name)) BETWEEN 1 AND 120);

CREATE OR REPLACE FUNCTION public.sync_operational_expense_bank_tx()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.bank_transactions (
    bank_account_id, direction, source_kind, transaction_date, amount,
    payment_method, operational_expense_id, project_id, notes
  ) VALUES (
    NEW.bank_account_id, 'outflow', 'operational_expense', NEW.expense_date, NEW.amount,
    NEW.payment_method, NEW.id, NEW.project_id,
    nullif(left(concat_ws(' — ', nullif(btrim(NEW.name), ''), nullif(btrim(NEW.notes), '')), 1000), '')
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
$function$;
