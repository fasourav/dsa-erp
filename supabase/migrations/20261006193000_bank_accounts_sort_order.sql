-- Settings orders bank accounts the same way as the other catalogs.
-- The operating-account insert stays a fallback for when no row exists.

ALTER TABLE public.bank_accounts
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (ORDER BY created_at, id)::integer AS next_sort
  FROM public.bank_accounts
)
UPDATE public.bank_accounts AS account
SET sort_order = ranked.next_sort
FROM ranked
WHERE account.id = ranked.id;

COMMENT ON COLUMN public.bank_accounts.sort_order IS
  'Display order for Settings and bank account pickers. Lower numbers come first.';

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

  IF resolved IS NOT NULL THEN
    RETURN resolved;
  END IF;

  INSERT INTO public.bank_accounts (name, currency, is_active, sort_order)
  VALUES ('Operating account', 'BDT', true, 1)
  RETURNING id INTO resolved;

  RETURN resolved;
END;
$$;
