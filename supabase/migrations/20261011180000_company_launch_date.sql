ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS launch_date date;

UPDATE public.company_settings
SET launch_date = DATE '2021-01-01'
WHERE launch_date IS NULL;

INSERT INTO public.company_settings (id, fiscal_year_start_month, launch_date)
VALUES (true, 7, DATE '2021-01-01')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.company_settings
  ALTER COLUMN launch_date SET DEFAULT DATE '2021-01-01';

ALTER TABLE public.company_settings
  ALTER COLUMN launch_date SET NOT NULL;

COMMENT ON COLUMN public.company_settings.launch_date IS
  'Operational tenure launch date. In Operation, revenue per day, and net profit per day are measured from this date.';
