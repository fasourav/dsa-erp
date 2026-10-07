-- Backlog module: a recovery plan on the project, and the financial columns
-- the Backlog page reads from project_backlogs in one query.
--
-- Apply this file in the Supabase SQL editor for DSA ERP, or with
-- `supabase db push`. It is safe to run more than once.
--
-- recovery_plan is nullable text on public.projects. The check allows an
-- empty value and rejects more than 150 words, using the same rule as the
-- app: trim, then split on whitespace. The Backlog page updates this column
-- directly. Existing project save/delete paths do not write it.
--
-- project_backlogs keeps its current columns and appends total_paid,
-- expense_total, project_status, and recovery_plan. security_invoker stays
-- on so the view still follows RLS on projects, clients, and the financials
-- view's underlying tables.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS recovery_plan text;

COMMENT ON COLUMN public.projects.recovery_plan IS
  'Backlog recovery plan. At most 150 words. Edited from the Backlog module.';

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_recovery_plan_word_limit;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_recovery_plan_word_limit
  CHECK (
    recovery_plan IS NULL
    OR btrim(recovery_plan) = ''
    OR cardinality(regexp_split_to_array(btrim(recovery_plan), '[[:space:]]+')) <= 150
  );

CREATE OR REPLACE VIEW public.project_backlogs
WITH (security_invoker = true) AS
SELECT
  pf.project_id,
  pf.project_name,
  COALESCE(c.person_name, c.company_name) AS client_name,
  pf.total_value AS project_value,
  pf.backlog_amount,
  pf.total_paid,
  pf.expense_total,
  p.status AS project_status,
  p.recovery_plan
FROM public.project_financials pf
JOIN public.clients c ON c.id = pf.client_id
JOIN public.projects p ON p.id = pf.project_id
WHERE pf.backlog_amount > 0;

ALTER VIEW public.project_backlogs SET (security_invoker = true);

GRANT SELECT ON public.project_backlogs TO authenticated, anon;
