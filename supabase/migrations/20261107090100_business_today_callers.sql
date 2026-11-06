-- v1.1.2: replace session-UTC CURRENT_DATE with private.business_today() (Asia/Dhaka)
-- in deployed functions/views. Generated from TEST pg_get_functiondef/pg_get_viewdef,
-- then reviewed by hand. Bodies are otherwise identical to what is deployed.

CREATE OR REPLACE FUNCTION private.vendor_purchase_orders_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  stored private.vendor_purchase_orders;
begin
  if tg_op = 'INSERT' then
    insert into private.vendor_purchase_orders (
      id, project_id, vendor_id, issued_on, work_type, total_value, notes,
      created_at, updated_at, expense_category_id, office_expense_category_id
    ) values (
      coalesce(new.id, pg_catalog.gen_random_uuid()),
      new.project_id,
      new.vendor_id,
      coalesce(new.issued_on, private.business_today()),
      new.work_type,
      coalesce(new.total_value, 0),
      new.notes,
      coalesce(new.created_at, pg_catalog.now()),
      coalesce(new.updated_at, pg_catalog.now()),
      new.expense_category_id,
      new.office_expense_category_id
    )
    returning * into stored;
  elsif tg_op = 'UPDATE' then
    update private.vendor_purchase_orders as row
    set
      project_id = new.project_id,
      vendor_id = new.vendor_id,
      issued_on = new.issued_on,
      work_type = new.work_type,
      total_value = case
        when private.session_sees_money() then new.total_value
        when new.total_value is null then row.total_value
        else new.total_value
      end,
      notes = new.notes,
      updated_at = new.updated_at,
      expense_category_id = new.expense_category_id,
      office_expense_category_id = new.office_expense_category_id
    where row.id = old.id
    returning * into stored;
    if not found then
      return null;
    end if;
  else
    delete from private.vendor_purchase_orders as row
    where row.id = old.id
    returning * into stored;
    if not found then
      return null;
    end if;
  end if;

  if not private.session_sees_money() then
    stored.total_value := null;
  end if;
  return stored;
end;
$function$
;

create or replace view public.accounts_payable_aging with (security_invoker=true) as  SELECT id,
    due_date,
    current_status,
    purchase_order_id,
    project_id,
    project_name,
    vendor_id,
    vendor_name,
    (
        CASE
            WHEN private.sees_money() THEN total_payable
            ELSE NULL::numeric
        END)::numeric(14,2) AS total_payable,
    (
        CASE
            WHEN private.sees_money() THEN total_paid
            ELSE NULL::numeric
        END)::numeric(14,2) AS total_paid,
    (
        CASE
            WHEN private.sees_money() THEN pending_payable
            ELSE NULL::numeric
        END)::numeric(14,2) AS pending_payable,
    issued_on,
    created_at,
    aging_bucket,
    days_past_due
   FROM ( SELECT ap.id,
            ap.due_date,
            ap.current_status,
            ap.purchase_order_id,
            ap.project_id,
            ap.project_name,
            ap.vendor_id,
            ap.vendor_name,
            ap.total_payable,
            ap.total_paid,
            ap.pending_payable,
            ap.issued_on,
            ap.created_at,
                CASE
                    WHEN (ap.pending_payable <= (0)::numeric) THEN 'paid'::text
                    WHEN (ap.due_date IS NULL) THEN 'no_due_date'::text
                    WHEN (private.business_today() <= ap.due_date) THEN 'current'::text
                    WHEN ((private.business_today() - ap.due_date) <= 30) THEN '1_30'::text
                    WHEN ((private.business_today() - ap.due_date) <= 60) THEN '31_60'::text
                    WHEN ((private.business_today() - ap.due_date) <= 90) THEN '61_90'::text
                    ELSE '90_plus'::text
                END AS aging_bucket,
            GREATEST((private.business_today() - ap.due_date), 0) AS days_past_due
           FROM accounts_payable ap) s
  WHERE private.can('accounts_payable'::text, 'view'::text);

create or replace view public.accounts_receivable_aging with (security_invoker=true) as  SELECT id,
    due_date,
    current_status,
    project_id,
    project_name,
    client_id,
    client_name,
    (
        CASE
            WHEN private.sees_money() THEN billed_amount
            ELSE NULL::numeric
        END)::numeric(14,2) AS billed_amount,
    (
        CASE
            WHEN private.sees_money() THEN paid
            ELSE NULL::numeric
        END)::numeric(14,2) AS paid,
    (
        CASE
            WHEN private.sees_money() THEN due
            ELSE NULL::numeric
        END)::numeric(14,2) AS due,
    issued_on,
    created_at,
    aging_bucket,
    days_past_due
   FROM ( SELECT ar.id,
            ar.due_date,
            ar.current_status,
            ar.project_id,
            ar.project_name,
            ar.client_id,
            ar.client_name,
            ar.billed_amount,
            ar.paid,
            ar.due,
            ar.issued_on,
            ar.created_at,
                CASE
                    WHEN (ar.due <= (0)::numeric) THEN 'paid'::text
                    WHEN (ar.due_date IS NULL) THEN 'no_due_date'::text
                    WHEN (private.business_today() <= ar.due_date) THEN 'current'::text
                    WHEN ((private.business_today() - ar.due_date) <= 30) THEN '1_30'::text
                    WHEN ((private.business_today() - ar.due_date) <= 60) THEN '31_60'::text
                    WHEN ((private.business_today() - ar.due_date) <= 90) THEN '61_90'::text
                    ELSE '90_plus'::text
                END AS aging_bucket,
            GREATEST((private.business_today() - ar.due_date), 0) AS days_past_due
           FROM accounts_receivable ar) s
  WHERE private.can('accounts_receivable'::text, 'view'::text);

create or replace view public.asset_register with (security_invoker=true) as  SELECT asset_id,
    purchase_date,
    name,
    category,
    quantity,
    (
        CASE
            WHEN private.sees_money() THEN unit_cost
            ELSE NULL::numeric
        END)::numeric(14,2) AS unit_cost,
    (
        CASE
            WHEN private.sees_money() THEN total_cost
            ELSE NULL::numeric
        END)::numeric(14,2) AS total_cost,
    lifespan_years,
    lifespan_months,
    months_used,
        CASE
            WHEN private.sees_money() THEN monthly_depreciation
            ELSE NULL::numeric
        END AS monthly_depreciation,
    (
        CASE
            WHEN private.sees_money() THEN current_value
            ELSE NULL::numeric
        END)::numeric(14,2) AS current_value,
    notes,
    created_at
   FROM ( SELECT a.id AS asset_id,
            a.purchase_date,
            a.name,
            c.name AS category,
            a.quantity,
            a.unit_cost,
            a.total_cost,
            a.lifespan_years,
            ((a.lifespan_years * (12)::numeric))::numeric(10,2) AS lifespan_months,
            (LEAST((a.lifespan_years * (12)::numeric), GREATEST((0)::numeric, (((EXTRACT(year FROM age((private.business_today())::timestamp with time zone, (a.purchase_date)::timestamp with time zone)) * (12)::numeric) + EXTRACT(month FROM age((private.business_today())::timestamp with time zone, (a.purchase_date)::timestamp with time zone))) + (EXTRACT(day FROM age((private.business_today())::timestamp with time zone, (a.purchase_date)::timestamp with time zone)) / 30.0)))))::numeric(10,2) AS months_used,
                CASE
                    WHEN ((a.lifespan_years * (12)::numeric) = (0)::numeric) THEN (0)::numeric
                    ELSE round((a.total_cost / (a.lifespan_years * (12)::numeric)), 2)
                END AS monthly_depreciation,
            (GREATEST((0)::numeric, (a.total_cost - (LEAST((a.lifespan_years * (12)::numeric), GREATEST((0)::numeric, (((EXTRACT(year FROM age((private.business_today())::timestamp with time zone, (a.purchase_date)::timestamp with time zone)) * (12)::numeric) + EXTRACT(month FROM age((private.business_today())::timestamp with time zone, (a.purchase_date)::timestamp with time zone))) + (EXTRACT(day FROM age((private.business_today())::timestamp with time zone, (a.purchase_date)::timestamp with time zone)) / 30.0)))) * (a.total_cost / NULLIF((a.lifespan_years * (12)::numeric), (0)::numeric))))))::numeric(14,2) AS current_value,
            a.notes,
            a.created_at
           FROM (assets a
             LEFT JOIN asset_categories c ON ((c.id = a.category_id)))) s
  WHERE private.can('assets'::text, 'view'::text);

create or replace view public.employee_details with (security_invoker=true) as  SELECT e.id,
    e.full_name,
    d.name AS department,
    e.designation,
    e.joining_date,
    e.leave_date,
    e.is_active,
    (GREATEST((0)::numeric, ((EXTRACT(year FROM age((COALESCE(e.leave_date, private.business_today()))::timestamp with time zone, (e.joining_date)::timestamp with time zone)) * (12)::numeric) + EXTRACT(month FROM age((COALESCE(e.leave_date, private.business_today()))::timestamp with time zone, (e.joining_date)::timestamp with time zone)))))::integer AS active_months,
    e.phone,
    e.email,
    e.notes,
    e.created_at
   FROM (employees e
     LEFT JOIN departments d ON ((d.id = e.department_id)));
