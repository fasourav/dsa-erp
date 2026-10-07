-- CRM UX: addresses, lead project_name, lead catalogs, cancelled status,
-- project expense = actually paid, client gross profit.

-- ---------------------------------------------------------------------------
-- 1) Contact address on clients and vendors
-- ---------------------------------------------------------------------------
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS address text;

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS address text;

-- ---------------------------------------------------------------------------
-- 2) leads.project_details -> project_name (UI label: Project Name)
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS public.lead_pipeline;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'project_details'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'project_name'
  ) THEN
    ALTER TABLE public.leads RENAME COLUMN project_details TO project_name;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3) Lead status as text + cancelled (catalog-driven; Open/Closed via is_open)
-- ---------------------------------------------------------------------------
ALTER TABLE public.leads
  ALTER COLUMN status DROP DEFAULT;

ALTER TABLE public.leads
  ALTER COLUMN status TYPE text USING status::text;

DROP TYPE IF EXISTS public.lead_status;

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_status_check;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_status_check
  CHECK (status = ANY (ARRAY[
    'open'::text,
    'on_hold'::text,
    'won'::text,
    'lost'::text,
    'cancelled'::text
  ]));

ALTER TABLE public.leads
  ALTER COLUMN status SET DEFAULT 'open'::text;

-- ---------------------------------------------------------------------------
-- 4) Lead catalog tables (form options from DB)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_types_code_key UNIQUE (code),
  CONSTRAINT lead_types_name_key UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS public.lead_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_sources_name_key UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS public.lead_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_stages_name_key UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS public.lead_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  is_open boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_statuses_code_key UNIQUE (code),
  CONSTRAINT lead_statuses_name_key UNIQUE (name)
);

CREATE UNIQUE INDEX IF NOT EXISTS lead_types_name_normalized_key
  ON public.lead_types (lower(trim(name)));
CREATE UNIQUE INDEX IF NOT EXISTS lead_sources_name_normalized_key
  ON public.lead_sources (lower(trim(name)));
CREATE UNIQUE INDEX IF NOT EXISTS lead_stages_name_normalized_key
  ON public.lead_stages (lower(trim(name)));
CREATE UNIQUE INDEX IF NOT EXISTS lead_statuses_name_normalized_key
  ON public.lead_statuses (lower(trim(name)));

INSERT INTO public.lead_types (code, name, sort_order)
VALUES
  ('person', 'Person', 1),
  ('company', 'Company', 2)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    sort_order = EXCLUDED.sort_order;

INSERT INTO public.lead_statuses (code, name, is_open, sort_order)
VALUES
  ('open', 'Open', true, 1),
  ('on_hold', 'On Hold', true, 2),
  ('won', 'Won', false, 3),
  ('lost', 'Lost', false, 4),
  ('cancelled', 'Cancelled', false, 5)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    is_open = EXCLUDED.is_open,
    sort_order = EXCLUDED.sort_order;

INSERT INTO public.lead_sources (name, sort_order)
VALUES
  ('Referral', 1),
  ('Website', 2),
  ('Walk-In', 3),
  ('Social Media', 4),
  ('Cold Call', 5),
  ('Other', 6)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.lead_stages (name, sort_order)
VALUES
  ('New', 1),
  ('Contacted', 2),
  ('Qualified', 3),
  ('Proposal', 4),
  ('Negotiation', 5),
  ('Won', 6),
  ('Lost', 7)
ON CONFLICT (name) DO NOTHING;

-- Seed catalogs from any existing free-text already on leads
INSERT INTO public.lead_sources (name, sort_order)
SELECT MIN(trim(l.source)), COALESCE((SELECT MAX(sort_order) FROM public.lead_sources), 0) + ROW_NUMBER() OVER (ORDER BY MIN(trim(l.source)))
FROM public.leads l
WHERE l.source IS NOT NULL AND trim(l.source) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.lead_sources s
    WHERE lower(trim(s.name)) = lower(trim(l.source))
  )
GROUP BY lower(trim(l.source));

INSERT INTO public.lead_stages (name, sort_order)
SELECT MIN(trim(l.current_stage)), COALESCE((SELECT MAX(sort_order) FROM public.lead_stages), 0) + ROW_NUMBER() OVER (ORDER BY MIN(trim(l.current_stage)))
FROM public.leads l
WHERE l.current_stage IS NOT NULL AND trim(l.current_stage) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.lead_stages s
    WHERE lower(trim(s.name)) = lower(trim(l.current_stage))
  )
GROUP BY lower(trim(l.current_stage));

ALTER TABLE public.lead_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_statuses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS authenticated_all_lead_types ON public.lead_types;
CREATE POLICY authenticated_all_lead_types ON public.lead_types
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_all_lead_sources ON public.lead_sources;
CREATE POLICY authenticated_all_lead_sources ON public.lead_sources
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_all_lead_stages ON public.lead_stages;
CREATE POLICY authenticated_all_lead_stages ON public.lead_stages
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_all_lead_statuses ON public.lead_statuses;
CREATE POLICY authenticated_all_lead_statuses ON public.lead_statuses
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_types TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_sources TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_stages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_statuses TO authenticated;

-- ---------------------------------------------------------------------------
-- 5) Recreate lead_pipeline with project_name
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.lead_pipeline AS
SELECT
  id AS lead_id,
  lead_name,
  kind,
  phone,
  email,
  project_name,
  project_type,
  source,
  estimated_value,
  current_stage,
  status,
  probability,
  CASE
    WHEN estimated_value IS NULL OR probability IS NULL THEN NULL::numeric
    ELSE round(((estimated_value * probability) / 100.0), 2)
  END AS weighted_value,
  converted_client_id,
  converted_project_id,
  created_at
FROM public.leads l;

-- ---------------------------------------------------------------------------
-- 6) project_financials: Expense = actually paid/spent; Due = unpaid PO balance
--    Gross profit = client paid - expense paid
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS public.project_backlogs;
DROP VIEW IF EXISTS public.client_summaries;
DROP VIEW IF EXISTS public.project_financials;

CREATE VIEW public.project_financials AS
WITH client_paid AS (
  SELECT
    ci.project_id,
    (COALESCE(sum(cp.amount), 0))::numeric(14, 2) AS total_paid
  FROM public.client_invoices ci
  LEFT JOIN public.client_payments cp ON cp.client_invoice_id = ci.id
  WHERE ci.status <> 'void'::payment_status
  GROUP BY ci.project_id
),
po_committed AS (
  SELECT
    project_id,
    (COALESCE(sum(total_value), 0))::numeric(14, 2) AS committed_total
  FROM public.vendor_purchase_orders
  GROUP BY project_id
),
vendor_expense_paid AS (
  SELECT
    po.project_id,
    (COALESCE(sum(vp.amount), 0))::numeric(14, 2) AS paid_total
  FROM public.vendor_purchase_orders po
  LEFT JOIN public.vendor_invoices vi ON vi.purchase_order_id = po.id
  LEFT JOIN public.vendor_payments vp ON vp.vendor_invoice_id = vi.id
  GROUP BY po.project_id
),
operational_expense_paid AS (
  SELECT
    project_id,
    (COALESCE(sum(amount), 0))::numeric(14, 2) AS paid_total
  FROM public.operational_expenses
  WHERE project_id IS NOT NULL
  GROUP BY project_id
)
SELECT
  p.id AS project_id,
  p.name AS project_name,
  p.client_id,
  p.total_value,
  COALESCE(cp.total_paid, 0)::numeric(14, 2) AS total_paid,
  GREATEST(p.total_value - COALESCE(cp.total_paid, 0), 0)::numeric(14, 2) AS total_pending_due,
  -- Expense: money actually paid/spent on the project
  (COALESCE(vep.paid_total, 0) + COALESCE(oep.paid_total, 0))::numeric(14, 2) AS expense_total,
  -- Expense Due: committed on POs but not yet paid
  GREATEST(COALESCE(poc.committed_total, 0) - COALESCE(vep.paid_total, 0), 0)::numeric(14, 2) AS expense_due,
  (COALESCE(cp.total_paid, 0) - (COALESCE(vep.paid_total, 0) + COALESCE(oep.paid_total, 0)))::numeric(14, 2) AS gross_profit,
  CASE
    WHEN COALESCE(vep.paid_total, 0) + COALESCE(oep.paid_total, 0) > COALESCE(cp.total_paid, 0)
      THEN (COALESCE(vep.paid_total, 0) + COALESCE(oep.paid_total, 0) - COALESCE(cp.total_paid, 0))
    ELSE 0::numeric
  END::numeric(14, 2) AS backlog_amount
FROM public.projects p
LEFT JOIN client_paid cp ON cp.project_id = p.id
LEFT JOIN po_committed poc ON poc.project_id = p.id
LEFT JOIN vendor_expense_paid vep ON vep.project_id = p.id
LEFT JOIN operational_expense_paid oep ON oep.project_id = p.id;

CREATE VIEW public.client_summaries AS
SELECT
  c.id AS client_id,
  c.kind,
  COALESCE(c.person_name, c.company_name) AS display_name,
  count(p.id) FILTER (WHERE p.status = 'active'::project_status) AS ongoing_projects,
  count(p.id) FILTER (WHERE p.status = 'completed'::project_status) AS completed_projects,
  (COALESCE(sum(pf.total_value), 0))::numeric(14, 2) AS total_project_value,
  (COALESCE(sum(pf.total_paid), 0))::numeric(14, 2) AS total_paid,
  (COALESCE(sum(pf.total_pending_due), 0))::numeric(14, 2) AS total_pending,
  (COALESCE(sum(pf.gross_profit), 0))::numeric(14, 2) AS gross_profit,
  CASE
    WHEN COALESCE(sum(pf.total_paid), 0) = 0 THEN NULL::numeric
    ELSE round((sum(pf.gross_profit) / NULLIF(sum(pf.total_paid), 0)) * 100, 1)
  END AS gross_profit_pct
FROM public.clients c
LEFT JOIN public.projects p ON p.client_id = c.id
LEFT JOIN public.project_financials pf ON pf.project_id = p.id
GROUP BY c.id;

CREATE VIEW public.project_backlogs AS
SELECT
  pf.project_id,
  pf.project_name,
  COALESCE(c.person_name, c.company_name) AS client_name,
  pf.total_value AS project_value,
  pf.backlog_amount
FROM public.project_financials pf
JOIN public.clients c ON c.id = pf.client_id
WHERE pf.backlog_amount > 0;

GRANT SELECT ON public.project_financials TO authenticated, anon;
GRANT SELECT ON public.client_summaries TO authenticated, anon;
GRANT SELECT ON public.project_backlogs TO authenticated, anon;
GRANT SELECT ON public.lead_pipeline TO authenticated, anon;
