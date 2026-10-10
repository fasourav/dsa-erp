-- New ledger kinds. Added in their own migration because a new enum value
-- cannot be used until the transaction that adds it has committed.

ALTER TYPE public.bank_source_kind ADD VALUE IF NOT EXISTS 'payroll';
ALTER TYPE public.bank_source_kind ADD VALUE IF NOT EXISTS 'transfer';
ALTER TYPE public.bank_source_kind ADD VALUE IF NOT EXISTS 'deposit';
ALTER TYPE public.bank_source_kind ADD VALUE IF NOT EXISTS 'withdrawal';
