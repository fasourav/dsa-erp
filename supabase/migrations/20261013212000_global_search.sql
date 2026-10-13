-- Permission-aware global search.
-- security invoker so RLS still applies. Each branch also requires View on that module.
-- authenticated may execute the RPC and the trigram helper. anon and public may not.

create extension if not exists pg_trgm;

create or replace function private.search_blob(variadic parts text[])
returns text
language sql
immutable
parallel safe
set search_path = public
as $$
  select lower(
    btrim(regexp_replace(coalesce(array_to_string(parts, ' '), ''), '[[:space:]]+', ' ', 'g'))
  );
$$;

revoke all on function private.search_blob(variadic text[]) from public, anon, authenticated, service_role;
grant execute on function private.search_blob(variadic text[]) to authenticated;

create index if not exists clients_search_trgm
  on public.clients
  using gin (private.search_blob(person_name, company_name, notes, email, phone) gin_trgm_ops);

create index if not exists leads_search_trgm
  on public.leads
  using gin (private.search_blob(lead_name, project_name, notes, email, estimated_value::text) gin_trgm_ops);

create index if not exists projects_search_trgm
  on public.projects
  using gin (private.search_blob(name, details, location, total_value::text) gin_trgm_ops);

create index if not exists vendors_search_trgm
  on public.vendors
  using gin (private.search_blob(person_name, company_name, notes, email, phone) gin_trgm_ops);

create index if not exists employees_search_trgm
  on public.employees
  using gin (private.search_blob(full_name, designation, notes, email, phone) gin_trgm_ops);

create index if not exists client_invoices_search_trgm
  on public.client_invoices
  using gin (private.search_blob(description, amount::text) gin_trgm_ops);

create index if not exists vendor_invoices_search_trgm
  on public.vendor_invoices
  using gin (private.search_blob(description, amount::text) gin_trgm_ops);

create index if not exists vendor_purchase_orders_search_trgm
  on public.vendor_purchase_orders
  using gin (private.search_blob(notes, work_type, total_value::text) gin_trgm_ops);

create index if not exists assets_search_trgm
  on public.assets
  using gin (private.search_blob(name, notes, unit_cost::text, total_cost::text) gin_trgm_ops);

create index if not exists bank_transactions_search_trgm
  on public.bank_transactions
  using gin (private.search_blob(notes, amount::text) gin_trgm_ops);

create or replace function public.search_records(query text)
returns table (
  module_key text,
  module_label text,
  record_id text,
  label text,
  detail text
)
language sql
stable
security invoker
set search_path = public
as $$
  with needle as (
    select case
      when query is null or length(btrim(query)) < 2 or length(btrim(query)) > 80 then null
      else lower(replace(replace(replace(btrim(query), '\', '\\'), '%', '\%'), '_', '\_'))
    end as value
  )
  select *
  from (
    (
      select
        'clients'::text,
        'Clients'::text,
        c.id::text,
        coalesce(nullif(btrim(c.person_name), ''), nullif(btrim(c.company_name), ''), 'Client'),
        left(coalesce(c.notes, ''), 140)
      from public.clients c
      cross join needle n
      where n.value is not null
        and private.can('clients', 'view')
        and private.search_blob(c.person_name, c.company_name, c.notes, c.email, c.phone)
          like '%' || n.value || '%' escape '\'
      order by 4
      limit 8
    )
    union all
    (
      select
        'leads'::text,
        'Leads'::text,
        l.id::text,
        coalesce(nullif(btrim(l.lead_name), ''), 'Lead'),
        left(coalesce(l.notes, l.project_name, ''), 140)
      from public.leads l
      cross join needle n
      where n.value is not null
        and private.can('leads', 'view')
        and private.search_blob(l.lead_name, l.project_name, l.notes, l.email, l.estimated_value::text)
          like '%' || n.value || '%' escape '\'
      order by 4
      limit 8
    )
    union all
    (
      select
        'projects'::text,
        'Projects'::text,
        p.id::text,
        coalesce(nullif(btrim(p.name), ''), 'Project'),
        left(coalesce(p.details, p.location, p.total_value::text, ''), 140)
      from public.projects p
      cross join needle n
      where n.value is not null
        and private.can('projects', 'view')
        and private.search_blob(p.name, p.details, p.location, p.total_value::text)
          like '%' || n.value || '%' escape '\'
      order by 4
      limit 8
    )
    union all
    (
      select
        'vendors'::text,
        'Vendors'::text,
        v.id::text,
        coalesce(nullif(btrim(v.person_name), ''), nullif(btrim(v.company_name), ''), 'Vendor'),
        left(coalesce(v.notes, ''), 140)
      from public.vendors v
      cross join needle n
      where n.value is not null
        and private.can('vendors', 'view')
        and private.search_blob(v.person_name, v.company_name, v.notes, v.email, v.phone)
          like '%' || n.value || '%' escape '\'
      order by 4
      limit 8
    )
    union all
    (
      select
        'employees'::text,
        'Employees'::text,
        e.id::text,
        coalesce(nullif(btrim(e.full_name), ''), 'Employee'),
        left(coalesce(e.designation, e.notes, ''), 140)
      from public.employees e
      cross join needle n
      where n.value is not null
        and private.can('employees', 'view')
        and private.search_blob(e.full_name, e.designation, e.notes, e.email, e.phone)
          like '%' || n.value || '%' escape '\'
      order by 4
      limit 8
    )
    union all
    (
      select
        'client_invoices'::text,
        'Client Invoices'::text,
        ci.id::text,
        coalesce(nullif(btrim(ci.description), ''), 'Invoice ' || ci.issued_on::text),
        ci.amount::text
      from public.client_invoices ci
      cross join needle n
      where n.value is not null
        and private.can('client_invoices', 'view')
        and private.search_blob(ci.description, ci.amount::text)
          like '%' || n.value || '%' escape '\'
      order by 4
      limit 8
    )
    union all
    (
      select
        'vendor_invoices'::text,
        'Vendor Invoices'::text,
        vi.purchase_order_id::text,
        coalesce(nullif(btrim(vi.description), ''), 'Vendor Invoice ' || vi.issued_on::text),
        vi.amount::text
      from public.vendor_invoices vi
      cross join needle n
      where n.value is not null
        and private.can('purchase_orders', 'view')
        and private.search_blob(vi.description, vi.amount::text)
          like '%' || n.value || '%' escape '\'
      order by 4
      limit 8
    )
    union all
    (
      select
        'purchase_orders'::text,
        'Purchase Orders'::text,
        po.id::text,
        coalesce(nullif(btrim(po.work_type), ''), 'Purchase Order ' || po.issued_on::text),
        left(coalesce(po.notes, po.total_value::text, ''), 140)
      from public.vendor_purchase_orders po
      cross join needle n
      where n.value is not null
        and private.can('purchase_orders', 'view')
        and private.search_blob(po.notes, po.work_type, po.total_value::text)
          like '%' || n.value || '%' escape '\'
      order by 4
      limit 8
    )
    union all
    (
      select
        'assets'::text,
        'Assets'::text,
        a.id::text,
        coalesce(nullif(btrim(a.name), ''), 'Asset'),
        left(coalesce(a.notes, a.total_cost::text, a.unit_cost::text, ''), 140)
      from public.assets a
      cross join needle n
      where n.value is not null
        and private.can('assets', 'view')
        and private.search_blob(a.name, a.notes, a.unit_cost::text, a.total_cost::text)
          like '%' || n.value || '%' escape '\'
      order by 4
      limit 8
    )
    union all
    (
      select
        'banking'::text,
        'Bank'::text,
        coalesce(bt.bank_account_id::text, ''),
        coalesce(nullif(btrim(bt.notes), ''), 'Bank Transaction ' || bt.transaction_date::text),
        bt.amount::text
      from public.bank_transactions bt
      cross join needle n
      where n.value is not null
        and private.can('banking', 'view')
        and private.search_blob(bt.notes, bt.amount::text)
          like '%' || n.value || '%' escape '\'
      order by 4
      limit 8
    )
  ) as hits(module_key, module_label, record_id, label, detail)
  order by module_label, label;
$$;

revoke all on function public.search_records(text) from public, anon, authenticated, service_role;
grant execute on function public.search_records(text) to authenticated;
