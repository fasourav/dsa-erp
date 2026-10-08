-- User-entered date for when a lead was added.
-- created_at stays the system timestamp and is not edited from the form.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS added_on date;

UPDATE public.leads
SET added_on = (created_at AT TIME ZONE 'UTC')::date
WHERE added_on IS NULL;

ALTER TABLE public.leads
  ALTER COLUMN added_on SET DEFAULT CURRENT_DATE;

ALTER TABLE public.leads
  ALTER COLUMN added_on SET NOT NULL;
