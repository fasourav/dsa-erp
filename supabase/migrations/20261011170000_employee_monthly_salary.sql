-- Monthly salary lives on the employee. A payroll run is paid in one step.
-- status stays on payroll_runs and is fixed to paid so the existing
-- payroll bank sync still posts one outflow per line.

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS monthly_salary numeric(14,2),
  ADD COLUMN IF NOT EXISTS allowance numeric(14,2) NOT NULL DEFAULT 0;

UPDATE public.employees
SET monthly_salary = 0
WHERE monthly_salary IS NULL;

ALTER TABLE public.employees
  ALTER COLUMN monthly_salary SET NOT NULL;

ALTER TABLE public.employees
  DROP CONSTRAINT IF EXISTS employees_monthly_salary_check;

ALTER TABLE public.employees
  ADD CONSTRAINT employees_monthly_salary_check CHECK (monthly_salary >= 0);

ALTER TABLE public.employees
  DROP CONSTRAINT IF EXISTS employees_allowance_check;

ALTER TABLE public.employees
  ADD CONSTRAINT employees_allowance_check CHECK (allowance >= 0);

UPDATE public.payroll_runs
SET status = 'paid'
WHERE status IS DISTINCT FROM 'paid';

ALTER TABLE public.payroll_runs
  ALTER COLUMN status SET DEFAULT 'paid';

ALTER TABLE public.payroll_runs
  DROP CONSTRAINT IF EXISTS payroll_runs_status_check;

ALTER TABLE public.payroll_runs
  ADD CONSTRAINT payroll_runs_status_check CHECK (status = 'paid');
