-- Allow lead statuses to be managed from Settings by referencing the catalog
-- instead of a fixed CHECK list. Normalized unique indexes already exist.

-- Ensure every lead status value exists in the catalog before adding the FK.
INSERT INTO public.lead_statuses (code, name, is_open, sort_order)
SELECT DISTINCT
  trim(l.status) AS code,
  initcap(replace(trim(l.status), '_', ' ')) AS name,
  CASE
    WHEN trim(l.status) IN ('open', 'on_hold') THEN true
    ELSE false
  END AS is_open,
  COALESCE((SELECT MAX(sort_order) FROM public.lead_statuses), 0)
    + ROW_NUMBER() OVER (ORDER BY trim(l.status))
FROM public.leads l
WHERE l.status IS NOT NULL
  AND trim(l.status) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM public.lead_statuses s
    WHERE s.code = trim(l.status)
  );

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_status_check;

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_status_fkey;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_status_fkey
  FOREIGN KEY (status)
  REFERENCES public.lead_statuses (code)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

-- Keep grants explicit for authenticated catalog CRUD.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_sources TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_stages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_statuses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_types TO authenticated;
