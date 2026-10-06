-- Vendor Category is free text on vendors.vendor_field and a catalog row in
-- vendor_work_categories. Names must be unique ignoring case and surrounding
-- spaces, and any category already saved on a vendor must exist in the catalog.

-- Keep one row per trimmed, case-insensitive name (lowest sort_order, then id).
DELETE FROM public.vendor_work_categories AS duplicate
USING public.vendor_work_categories AS keeper
WHERE duplicate.id <> keeper.id
  AND lower(trim(duplicate.name)) = lower(trim(keeper.name))
  AND (
    duplicate.sort_order > keeper.sort_order
    OR (
      duplicate.sort_order = keeper.sort_order
      AND duplicate.id > keeper.id
    )
  );

UPDATE public.vendor_work_categories
SET name = trim(name)
WHERE name IS DISTINCT FROM trim(name);

CREATE UNIQUE INDEX IF NOT EXISTS vendor_work_categories_name_normalized_key
  ON public.vendor_work_categories (lower(trim(name)));

WITH bounds AS (
  SELECT COALESCE(MAX(sort_order), 0) AS max_sort
  FROM public.vendor_work_categories
),
missing AS (
  SELECT MIN(trim(vendors.vendor_field)) AS name
  FROM public.vendors
  WHERE vendors.vendor_field IS NOT NULL
    AND trim(vendors.vendor_field) <> ''
    AND NOT EXISTS (
      SELECT 1
      FROM public.vendor_work_categories AS existing
      WHERE lower(trim(existing.name)) = lower(trim(vendors.vendor_field))
    )
  GROUP BY lower(trim(vendors.vendor_field))
)
INSERT INTO public.vendor_work_categories (name, sort_order)
SELECT
  missing.name,
  bounds.max_sort + ROW_NUMBER() OVER (ORDER BY missing.name)
FROM missing
CROSS JOIN bounds;
