-- Printable business documents.
-- Quotations and work orders are first-class records.
-- Client invoices, client payments, and purchase orders keep their books
-- and gain a print snapshot in issued_documents.
-- Public verification is a private security-definer lookup that returns
-- only document number, date, total, and status. The token is unguessable.
-- This file is not applied by the app. Apply it with the normal migration flow.

create schema if not exists private;

alter table public.company_settings
  add column if not exists print_margin_top_mm smallint not null default 32,
  add column if not exists print_margin_bottom_mm smallint not null default 28;

alter table public.company_settings
  drop constraint if exists company_settings_print_margins_check;

alter table public.company_settings
  add constraint company_settings_print_margins_check
  check (
    print_margin_top_mm between 0 and 80
    and print_margin_bottom_mm between 0 and 80
  );

comment on column public.company_settings.print_margin_top_mm is
  'Blank millimetres above printable document content, for the pre-printed letterhead.';
comment on column public.company_settings.print_margin_bottom_mm is
  'Blank millimetres below printable document content, for the pre-printed pad footer.';

insert into public.permission_modules (key, label, sort_order, owners_only)
values
  ('quotations', 'Quotations', 62, false),
  ('work_orders', 'Work Orders', 64, false)
on conflict (key) do update
set label = excluded.label,
    sort_order = excluded.sort_order,
    owners_only = excluded.owners_only;

insert into public.role_template_permissions (
  template_id, module, can_view, can_add, can_edit, can_delete
)
select t.id, m.key, false, false, false, false
from public.role_templates t
cross join public.permission_modules m
where m.key in ('quotations', 'work_orders')
on conflict (template_id, module) do nothing;

update public.role_template_permissions target
set
  can_view = source.can_view,
  can_add = source.can_add,
  can_edit = source.can_edit,
  can_delete = source.can_delete
from public.role_template_permissions source
where target.template_id = source.template_id
  and target.module = 'quotations'
  and source.module = 'client_invoices';

update public.role_template_permissions target
set
  can_view = source.can_view,
  can_add = source.can_add,
  can_edit = source.can_edit,
  can_delete = source.can_delete
from public.role_template_permissions source
where target.template_id = source.template_id
  and target.module = 'work_orders'
  and source.module = 'purchase_orders';

insert into public.user_permissions (
  user_id, module, can_view, can_add, can_edit, can_delete
)
select user_id, 'quotations', can_view, can_add, can_edit, can_delete
from public.user_permissions
where module = 'client_invoices'
on conflict (user_id, module) do nothing;

insert into public.user_permissions (
  user_id, module, can_view, can_add, can_edit, can_delete
)
select user_id, 'work_orders', can_view, can_add, can_edit, can_delete
from public.user_permissions
where module = 'purchase_orders'
on conflict (user_id, module) do nothing;

create table public.quotations (
  id uuid primary key default gen_random_uuid(),
  document_no text not null unique,
  issued_on date not null,
  valid_until date,
  status text not null default 'draft'
    check (status in ('draft', 'issued', 'accepted', 'declined', 'void')),
  client_id uuid not null references public.clients (id) on delete restrict,
  project_id uuid references public.projects (id) on delete restrict,
  area text not null default '',
  subject text not null default '',
  terms text not null default '',
  exclusions text not null default '',
  ait_percent numeric(6, 2) not null default 0
    check (ait_percent >= 0 and ait_percent <= 100),
  total numeric(14, 2) not null default 0 check (total >= 0),
  prepared_by text not null default '',
  authorized_by text not null default '',
  verify_token text not null unique check (verify_token ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.quotation_lines (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations (id) on delete cascade,
  sort_order integer not null check (sort_order >= 0 and sort_order < 40),
  section_name text not null default '',
  item text not null,
  specification text not null default '',
  quantity numeric(14, 2),
  unit text not null default '',
  unit_price numeric(14, 2),
  unique (quotation_id, sort_order)
);

create table public.quotation_milestones (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations (id) on delete cascade,
  sort_order integer not null check (sort_order >= 0 and sort_order < 12),
  label text not null,
  percent numeric(6, 2) not null check (percent >= 0 and percent <= 100),
  unique (quotation_id, sort_order)
);

create table public.work_orders (
  id uuid primary key default gen_random_uuid(),
  document_no text not null unique,
  issued_on date not null,
  status text not null default 'draft'
    check (status in ('draft', 'issued', 'accepted', 'completed', 'void')),
  vendor_id uuid not null references public.vendors (id) on delete restrict,
  project_id uuid references public.projects (id) on delete restrict,
  proposal_on date,
  work_start date,
  work_end date,
  subject text not null default '',
  introduction text not null default '',
  terms text not null default '',
  total numeric(14, 2) not null default 0 check (total >= 0),
  prepared_by text not null default '',
  authorized_by text not null default '',
  verify_token text not null unique check (verify_token ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.work_order_lines (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders (id) on delete cascade,
  sort_order integer not null check (sort_order >= 0 and sort_order < 40),
  section_name text not null default '',
  item text not null,
  specification text not null default '',
  quantity numeric(14, 2),
  unit text not null default '',
  unit_price numeric(14, 2),
  unique (work_order_id, sort_order)
);

create table public.work_order_milestones (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders (id) on delete cascade,
  sort_order integer not null check (sort_order >= 0 and sort_order < 12),
  label text not null,
  percent numeric(6, 2) not null check (percent >= 0 and percent <= 100),
  unique (work_order_id, sort_order)
);

create table public.issued_documents (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('invoice', 'receipt', 'purchase_order')),
  client_invoice_id uuid references public.client_invoices (id) on delete cascade,
  client_payment_id uuid references public.client_payments (id) on delete cascade,
  purchase_order_id uuid references public.vendor_purchase_orders (id) on delete cascade,
  document_no text not null unique,
  issued_on date not null,
  total numeric(14, 2) not null check (total >= 0),
  status text not null,
  verify_token text not null unique check (verify_token ~ '^[0-9a-f]{64}$'),
  body jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint issued_documents_source_check check (
    (
      kind = 'invoice'
      and client_invoice_id is not null
      and client_payment_id is null
      and purchase_order_id is null
    )
    or (
      kind = 'receipt'
      and client_payment_id is not null
      and client_invoice_id is null
      and purchase_order_id is null
    )
    or (
      kind = 'purchase_order'
      and purchase_order_id is not null
      and client_invoice_id is null
      and client_payment_id is null
    )
  )
);

create unique index issued_documents_invoice_key
  on public.issued_documents (client_invoice_id)
  where client_invoice_id is not null;

create unique index issued_documents_receipt_key
  on public.issued_documents (client_payment_id)
  where client_payment_id is not null;

create unique index issued_documents_po_key
  on public.issued_documents (purchase_order_id)
  where purchase_order_id is not null;

create index quotations_client_idx on public.quotations (client_id);
create index quotations_project_idx on public.quotations (project_id);
create index work_orders_vendor_idx on public.work_orders (vendor_id);
create index work_orders_project_idx on public.work_orders (project_id);
create index quotation_lines_quotation_idx on public.quotation_lines (quotation_id);
create index quotation_milestones_quotation_idx on public.quotation_milestones (quotation_id);
create index work_order_lines_work_order_idx on public.work_order_lines (work_order_id);
create index work_order_milestones_work_order_idx on public.work_order_milestones (work_order_id);

call private.apply_crud('quotations', array['quotations'], 'quotations');
call private.apply_crud('work_orders', array['work_orders'], 'work_orders');

alter table public.quotation_lines enable row level security;
alter table public.quotation_milestones enable row level security;
alter table public.work_order_lines enable row level security;
alter table public.work_order_milestones enable row level security;
alter table public.issued_documents enable row level security;

create policy quotation_lines_select on public.quotation_lines
  for select to authenticated
  using (private.can('quotations', 'view'));
create policy quotation_lines_insert on public.quotation_lines
  for insert to authenticated
  with check (private.can('quotations', 'add') or private.can('quotations', 'edit'));
create policy quotation_lines_update on public.quotation_lines
  for update to authenticated
  using (private.can('quotations', 'edit'))
  with check (private.can('quotations', 'edit'));
create policy quotation_lines_delete on public.quotation_lines
  for delete to authenticated
  using (private.can('quotations', 'edit') or private.can('quotations', 'delete'));

create policy quotation_milestones_select on public.quotation_milestones
  for select to authenticated
  using (private.can('quotations', 'view'));
create policy quotation_milestones_insert on public.quotation_milestones
  for insert to authenticated
  with check (private.can('quotations', 'add') or private.can('quotations', 'edit'));
create policy quotation_milestones_update on public.quotation_milestones
  for update to authenticated
  using (private.can('quotations', 'edit'))
  with check (private.can('quotations', 'edit'));
create policy quotation_milestones_delete on public.quotation_milestones
  for delete to authenticated
  using (private.can('quotations', 'edit') or private.can('quotations', 'delete'));

create policy work_order_lines_select on public.work_order_lines
  for select to authenticated
  using (private.can('work_orders', 'view'));
create policy work_order_lines_insert on public.work_order_lines
  for insert to authenticated
  with check (private.can('work_orders', 'add') or private.can('work_orders', 'edit'));
create policy work_order_lines_update on public.work_order_lines
  for update to authenticated
  using (private.can('work_orders', 'edit'))
  with check (private.can('work_orders', 'edit'));
create policy work_order_lines_delete on public.work_order_lines
  for delete to authenticated
  using (private.can('work_orders', 'edit') or private.can('work_orders', 'delete'));

create policy work_order_milestones_select on public.work_order_milestones
  for select to authenticated
  using (private.can('work_orders', 'view'));
create policy work_order_milestones_insert on public.work_order_milestones
  for insert to authenticated
  with check (private.can('work_orders', 'add') or private.can('work_orders', 'edit'));
create policy work_order_milestones_update on public.work_order_milestones
  for update to authenticated
  using (private.can('work_orders', 'edit'))
  with check (private.can('work_orders', 'edit'));
create policy work_order_milestones_delete on public.work_order_milestones
  for delete to authenticated
  using (private.can('work_orders', 'edit') or private.can('work_orders', 'delete'));

create policy issued_documents_select on public.issued_documents
  for select to authenticated
  using (
    (kind in ('invoice', 'receipt') and private.can('client_invoices', 'view'))
    or (kind = 'purchase_order' and private.can('purchase_orders', 'view'))
  );
create policy issued_documents_insert on public.issued_documents
  for insert to authenticated
  with check (
    (kind in ('invoice', 'receipt') and private.can('client_invoices', 'add'))
    or (kind = 'purchase_order' and private.can('purchase_orders', 'add'))
  );
create policy issued_documents_update on public.issued_documents
  for update to authenticated
  using (
    (kind in ('invoice', 'receipt') and private.can('client_invoices', 'edit'))
    or (kind = 'purchase_order' and private.can('purchase_orders', 'edit'))
  )
  with check (
    (kind in ('invoice', 'receipt') and private.can('client_invoices', 'edit'))
    or (kind = 'purchase_order' and private.can('purchase_orders', 'edit'))
  );
create policy issued_documents_delete on public.issued_documents
  for delete to authenticated
  using (
    (kind in ('invoice', 'receipt') and private.can('client_invoices', 'delete'))
    or (kind = 'purchase_order' and private.can('purchase_orders', 'delete'))
  );

revoke all on table public.quotations from anon, public;
revoke all on table public.quotation_lines from anon, public;
revoke all on table public.quotation_milestones from anon, public;
revoke all on table public.work_orders from anon, public;
revoke all on table public.work_order_lines from anon, public;
revoke all on table public.work_order_milestones from anon, public;
revoke all on table public.issued_documents from anon, public;

grant select, insert, update, delete on public.quotations to authenticated;
grant select, insert, update, delete on public.quotation_lines to authenticated;
grant select, insert, update, delete on public.quotation_milestones to authenticated;
grant select, insert, update, delete on public.work_orders to authenticated;
grant select, insert, update, delete on public.work_order_lines to authenticated;
grant select, insert, update, delete on public.work_order_milestones to authenticated;
grant select, insert, update, delete on public.issued_documents to authenticated;

create table private.document_verify_hits (
  token_hash text not null,
  created_at timestamptz not null default now()
);

create index document_verify_hits_created_idx
  on private.document_verify_hits (created_at desc);

create index document_verify_hits_token_idx
  on private.document_verify_hits (token_hash, created_at desc);

revoke all on table private.document_verify_hits from public, anon, authenticated, service_role;

create or replace function private.verify_business_document(p_token text)
returns table (
  outcome text,
  document_no text,
  issued_on date,
  total numeric,
  status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  hashed text;
  recent_token integer;
  recent_global integer;
  matched boolean;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return query
    select 'missing'::text, null::text, null::date, null::numeric, null::text;
    return;
  end if;

  hashed := md5(p_token);

  delete from private.document_verify_hits
  where created_at < now() - interval '1 day';

  select count(*)::integer
  into recent_global
  from private.document_verify_hits
  where created_at > now() - interval '1 minute';

  if recent_global >= 300 then
    return query
    select 'limited'::text, null::text, null::date, null::numeric, null::text;
    return;
  end if;

  insert into private.document_verify_hits (token_hash)
  values (hashed);

  select count(*)::integer
  into recent_token
  from private.document_verify_hits
  where token_hash = hashed
    and created_at > now() - interval '10 minutes';

  if recent_token > 30 then
    return query
    select 'limited'::text, null::text, null::date, null::numeric, null::text;
    return;
  end if;

  matched := exists (
    select 1 from public.issued_documents d where d.verify_token = p_token
    union all
    select 1 from public.quotations q where q.verify_token = p_token
    union all
    select 1 from public.work_orders w where w.verify_token = p_token
  );

  if not matched then
    return query
    select 'missing'::text, null::text, null::date, null::numeric, null::text;
    return;
  end if;

  return query
  select
    'ok'::text,
    found.document_no,
    found.issued_on,
    found.total,
    found.status
  from (
    select
      d.document_no,
      d.issued_on,
      d.total,
      case
        when d.kind = 'receipt' then 'Received'
        when d.kind = 'invoice' and i.id is not null and i.status = 'void' then 'Void'
        when d.kind = 'invoice' and i.id is not null and coalesce(pay.paid, 0) <= 0 then 'Unpaid'
        when d.kind = 'invoice' and i.id is not null and coalesce(pay.paid, 0) + 0.009 < i.amount then 'Partial'
        when d.kind = 'invoice' and i.id is not null then 'Paid'
        else 'Issued'
      end as status
    from public.issued_documents d
    left join public.client_invoices i on i.id = d.client_invoice_id
    left join lateral (
      select sum(p.amount) as paid
      from public.client_payments p
      where p.client_invoice_id = i.id
    ) pay on true
    where d.verify_token = p_token

    union all

    select
      q.document_no,
      q.issued_on,
      q.total,
      case q.status
        when 'draft' then 'Draft'
        when 'issued' then 'Issued'
        when 'accepted' then 'Accepted'
        when 'declined' then 'Declined'
        when 'void' then 'Void'
        else 'Issued'
      end
    from public.quotations q
    where q.verify_token = p_token

    union all

    select
      w.document_no,
      w.issued_on,
      w.total,
      case w.status
        when 'draft' then 'Draft'
        when 'issued' then 'Issued'
        when 'accepted' then 'Accepted'
        when 'completed' then 'Completed'
        when 'void' then 'Void'
        else 'Issued'
      end
    from public.work_orders w
    where w.verify_token = p_token
  ) found
  limit 1;
end;
$$;

revoke all on function private.verify_business_document(text) from public, anon, authenticated, service_role;
grant execute on function private.verify_business_document(text) to anon, authenticated;
grant usage on schema private to anon, authenticated;

create or replace function public.verify_business_document(p_token text)
returns table (
  outcome text,
  document_no text,
  issued_on date,
  total numeric,
  status text
)
language sql
security invoker
set search_path = ''
as $$
  select outcome, document_no, issued_on, total, status
  from private.verify_business_document(p_token);
$$;

revoke all on function public.verify_business_document(text) from public;
grant execute on function public.verify_business_document(text) to anon, authenticated;

comment on function public.verify_business_document(text) is
  'Public read of a business document by unguessable token. Returns number, date, total, and status only.';


-- Keep the activity log on the document module instead of the settings fallback.

create or replace function private.audit_label(target_table text, row_data jsonb)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  label text;
begin
  if target_table in ('clients', 'vendors') then
    label := coalesce(
      nullif(btrim(row_data->>'person_name'), ''),
      nullif(btrim(row_data->>'company_name'), '')
    );
  elsif target_table = 'leads' then
    label := nullif(btrim(row_data->>'lead_name'), '');
  elsif target_table in (
    'projects', 'employees', 'assets', 'asset_categories', 'bank_accounts',
    'departments', 'lead_sources', 'lead_stages', 'lead_statuses', 'lead_types',
    'office_expense_categories', 'payment_methods', 'project_expense_categories',
    'project_phases', 'project_types', 'vendor_work_categories'
  ) then
    label := coalesce(
      nullif(btrim(row_data->>'name'), ''),
      nullif(btrim(row_data->>'full_name'), '')
    );
  elsif target_table = 'client_invoices' then
    label := coalesce(
      nullif(btrim(row_data->>'description'), ''),
      'Invoice ' || nullif(row_data->>'issued_on', '')
    );
  elsif target_table = 'vendor_invoices' then
    label := coalesce(
      nullif(btrim(row_data->>'description'), ''),
      'Vendor Invoice ' || nullif(row_data->>'issued_on', '')
    );
  elsif target_table in ('client_payments', 'vendor_payments') then
    label := coalesce(
      nullif(btrim(row_data->>'reference'), ''),
      nullif(btrim(row_data->>'notes'), ''),
      'Payment ' || nullif(row_data->>'paid_on', '')
    );
  elsif target_table = 'vendor_purchase_orders' then
    label := coalesce(
      nullif(btrim(row_data->>'work_type'), ''),
      'Purchase Order ' || nullif(row_data->>'issued_on', '')
    );
  elsif target_table = 'vat_tax_payments' then
    label := coalesce(
      nullif(btrim(row_data->>'notes'), ''),
      'VAT Payment ' || nullif(row_data->>'paid_on', '')
    );
  elsif target_table = 'bank_transactions' then
    label := coalesce(
      nullif(btrim(row_data->>'notes'), ''),
      'Bank Transaction ' || nullif(row_data->>'transaction_date', '')
    );
  elsif target_table = 'bank_transfers' then
    label := coalesce(
      nullif(btrim(row_data->>'notes'), ''),
      'Transfer ' || nullif(row_data->>'transfer_date', '')
    );
  elsif target_table = 'operational_expenses' then
    label := coalesce(
      nullif(btrim(row_data->>'notes'), ''),
      nullif(btrim(row_data->>'category'), ''),
      'Expense ' || nullif(row_data->>'expense_date', '')
    );
  elsif target_table = 'budgets' then
    select d.name || ' ' || (row_data->>'period_year') || '-' || lpad(row_data->>'period_month', 2, '0')
    into label
    from public.departments d
    where d.id = nullif(row_data->>'department_id', '')::uuid;
  elsif target_table = 'payroll_runs' then
    label := 'Payroll ' || coalesce(row_data->>'period_year', '') || '-' || lpad(coalesce(row_data->>'period_month', ''), 2, '0');
  elsif target_table = 'payroll_lines' then
    select e.full_name
    into label
    from public.employees e
    where e.id = nullif(row_data->>'employee_id', '')::uuid;
  elsif target_table = 'profiles' then
    label := coalesce(
      nullif(btrim(row_data->>'display_name'), ''),
      nullif(btrim(row_data->>'email'), '')
    );
  elsif target_table = 'user_invites' then
    label := coalesce(
      nullif(btrim(row_data->>'display_name'), ''),
      nullif(btrim(row_data->>'email'), '')
    );
  elsif target_table = 'permission_modules' then
    label := nullif(btrim(row_data->>'label'), '');
  elsif target_table = 'role_templates' then
    label := nullif(btrim(row_data->>'label'), '');
  elsif target_table = 'role_template_permissions' then
    select rt.label || ' ' || (row_data->>'module')
    into label
    from public.role_templates rt
    where rt.id = nullif(row_data->>'template_id', '')::uuid;
  elsif target_table = 'user_permissions' then
    select coalesce(nullif(btrim(p.display_name), ''), nullif(btrim(p.email), ''), 'User')
      || ' ' || (row_data->>'module')
    into label
    from public.profiles p
    where p.id = nullif(row_data->>'user_id', '')::uuid;
  elsif target_table in ('quotations', 'work_orders', 'issued_documents') then
    label := nullif(btrim(row_data->>'document_no'), '');
  elsif target_table in ('quotation_lines', 'work_order_lines') then
    label := nullif(btrim(row_data->>'item'), '');
  elsif target_table in ('quotation_milestones', 'work_order_milestones') then
    label := nullif(btrim(row_data->>'label'), '');
  elsif target_table = 'company_settings' then
    label := 'Company Settings';
  end if;

  return coalesce(nullif(btrim(label), ''), 'Record');
exception
  when others then
    return 'Record';
end;
$$;

create or replace function private.log_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  row_data jsonb;
  new_row jsonb;
  old_row jsonb;
  changed_old jsonb;
  changed_new jsonb;
  module_key text;
  label text;
  row_id text;
  verb text;
begin
  begin
    if tg_op = 'DELETE' then
      verb := 'delete';
      row_data := to_jsonb(old);
    elsif tg_op = 'UPDATE' then
      verb := 'update';
      row_data := to_jsonb(new);
    else
      verb := 'insert';
      row_data := to_jsonb(new);
    end if;

    module_key := case tg_table_name
      when 'leads' then 'leads'
      when 'clients' then 'clients'
      when 'projects' then 'projects'
      when 'vendors' then 'vendors'
      when 'vendor_purchase_orders' then 'purchase_orders'
      when 'vendor_invoices' then 'vendor_payments'
      when 'vendor_payments' then 'vendor_payments'
      when 'client_invoices' then 'client_invoices'
      when 'client_payments' then 'client_invoices'
      when 'bank_accounts' then 'banking'
      when 'bank_transactions' then 'banking'
      when 'bank_transfers' then 'banking'
      when 'operational_expenses' then 'expenses'
      when 'vat_tax_payments' then 'vat_tax'
      when 'budgets' then 'budgets'
      when 'assets' then 'assets'
      when 'asset_categories' then 'assets'
      when 'employees' then 'employees'
      when 'payroll_runs' then 'payroll'
      when 'payroll_lines' then 'payroll'
      when 'profiles' then 'users'
      when 'permission_modules' then 'users'
      when 'role_templates' then 'users'
      when 'role_template_permissions' then 'users'
      when 'user_permissions' then 'users'
      when 'user_invites' then 'users'
      when 'quotations' then 'quotations'
      when 'quotation_lines' then 'quotations'
      when 'quotation_milestones' then 'quotations'
      when 'work_orders' then 'work_orders'
      when 'work_order_lines' then 'work_orders'
      when 'work_order_milestones' then 'work_orders'
      when 'issued_documents' then
        case
          when coalesce(row_data->>'kind', '') = 'purchase_order' then 'purchase_orders'
          else 'client_invoices'
        end
      else 'settings'
    end;

    if tg_table_name = 'user_permissions' then
      row_id := (row_data->>'user_id') || ':' || (row_data->>'module');
    elsif tg_table_name = 'role_template_permissions' then
      row_id := (row_data->>'template_id') || ':' || (row_data->>'module');
    else
      row_id := coalesce(row_data->>'id', row_data->>'key', row_data->>'email');
    end if;

    label := private.audit_label(tg_table_name, row_data);

    if tg_op = 'INSERT' then
      new_row := to_jsonb(new) - 'updated_at' - 'last_sign_in_at';
      changed_old := null;
      changed_new := new_row;
    elsif tg_op = 'DELETE' then
      old_row := to_jsonb(old) - 'updated_at' - 'last_sign_in_at';
      changed_old := old_row;
      changed_new := null;
    else
      new_row := to_jsonb(new) - 'updated_at' - 'last_sign_in_at';
      old_row := to_jsonb(old) - 'updated_at' - 'last_sign_in_at';
      if new_row is not distinct from old_row then
        return new;
      end if;

      select
        coalesce(jsonb_object_agg(entry.key, old_row -> entry.key), '{}'::jsonb),
        coalesce(jsonb_object_agg(entry.key, new_row -> entry.key), '{}'::jsonb)
      into changed_old, changed_new
      from jsonb_each(old_row || new_row) as entry(key, value)
      where (old_row -> entry.key) is distinct from (new_row -> entry.key);
    end if;

    insert into public.activity_log (
      actor_id,
      action,
      module,
      table_name,
      record_id,
      record_label,
      summary,
      old_values,
      new_values
    )
    values (
      auth.uid(),
      verb,
      module_key,
      tg_table_name,
      row_id,
      label,
      case verb
        when 'insert' then 'Added'
        when 'update' then 'Updated'
        else 'Deleted'
      end || ' ' || label,
      changed_old,
      changed_new
    );
  exception
    when others then
      null;
  end;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;



do 
declare
  item text;
begin
  foreach item in array array[
    'quotations',
    'quotation_lines',
    'quotation_milestones',
    'work_orders',
    'work_order_lines',
    'work_order_milestones',
    'issued_documents'
  ]
  loop
    execute format('drop trigger if exists %I on public.%I', item || '_activity', item);
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function private.log_activity()',
      item || '_activity',
      item
    );
  end loop;
end ;

revoke all on function private.audit_label(text, jsonb) from public, anon, authenticated;
revoke all on function private.log_activity() from public, anon, authenticated;
grant execute on function private.log_activity() to authenticated, service_role;
