-- Users & Permissions: role templates, per-user grants, can(), and activity log.

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;

alter table public.profiles
  add column if not exists status text not null default 'active',
  add column if not exists show_financials boolean not null default true,
  add column if not exists email text,
  add column if not exists last_sign_in_at timestamptz;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('owner', 'accountant', 'staff', 'custom'));

alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles
  add constraint profiles_status_check
  check (status in ('active', 'invited', 'deactivated'));

update public.profiles p
set
  email = u.email,
  last_sign_in_at = u.last_sign_in_at
from auth.users u
where u.id = p.id;

update public.profiles p
set role = 'owner', status = 'active', show_financials = true
from auth.users u
where u.id = p.id
  and lower(u.email) = 'fardin.ahsan10@gmail.com';

create table if not exists public.permission_modules (
  key text primary key,
  label text not null,
  sort_order integer not null,
  owners_only boolean not null default false
);

create table if not exists public.role_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  show_financials boolean not null default false,
  sort_order integer not null,
  created_at timestamptz not null default now()
);

create table if not exists public.role_template_permissions (
  template_id uuid not null references public.role_templates (id) on delete cascade,
  module text not null references public.permission_modules (key) on delete cascade,
  can_view boolean not null default false,
  can_add boolean not null default false,
  can_edit boolean not null default false,
  can_delete boolean not null default false,
  primary key (template_id, module)
);

create table if not exists public.user_permissions (
  user_id uuid not null references public.profiles (id) on delete cascade,
  module text not null references public.permission_modules (key) on delete cascade,
  can_view boolean not null default false,
  can_add boolean not null default false,
  can_edit boolean not null default false,
  can_delete boolean not null default false,
  primary key (user_id, module)
);

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null check (action in ('insert', 'update', 'delete')),
  module text not null,
  table_name text not null,
  record_id text,
  summary text not null,
  created_at timestamptz not null default now()
);

create index if not exists activity_log_created_at_idx
  on public.activity_log (created_at desc);

insert into public.permission_modules (key, label, sort_order, owners_only)
values
  ('dashboard', 'Dashboard', 10, false),
  ('leads', 'Leads', 20, false),
  ('clients', 'Clients', 30, false),
  ('projects', 'Projects', 40, false),
  ('backlog', 'Backlog', 50, false),
  ('purchase_orders', 'Purchase Orders', 60, false),
  ('vendors', 'Vendors', 70, false),
  ('vendor_payments', 'Vendor Payments', 80, false),
  ('accounts_payable', 'Accounts Payable', 90, false),
  ('client_invoices', 'Client Invoices', 100, false),
  ('accounts_receivable', 'Accounts Receivable', 110, false),
  ('income', 'Income', 120, false),
  ('expense', 'Expense', 130, false),
  ('expenses', 'Operational Expense', 140, false),
  ('banking', 'Bank', 150, false),
  ('vat_tax', 'VAT/Tax', 160, false),
  ('budgets', 'Budgets', 170, false),
  ('assets', 'Assets', 180, false),
  ('employees', 'Employees', 190, false),
  ('payroll', 'Payroll', 200, false),
  ('settings', 'Settings', 210, true),
  ('users', 'Users & Permissions', 220, true)
on conflict (key) do update
set label = excluded.label,
    sort_order = excluded.sort_order,
    owners_only = excluded.owners_only;

insert into public.role_templates (key, label, show_financials, sort_order)
values
  ('owner', 'Owner', true, 10),
  ('accountant', 'Accountant', true, 20),
  ('staff', 'Staff', false, 30),
  ('custom', 'Custom', false, 40)
on conflict (key) do update
set label = excluded.label,
    show_financials = excluded.show_financials,
    sort_order = excluded.sort_order;

insert into public.role_template_permissions (
  template_id, module, can_view, can_add, can_edit, can_delete
)
select t.id, m.key, false, false, false, false
from public.role_templates t
cross join public.permission_modules m
on conflict (template_id, module) do nothing;

update public.role_template_permissions rtp
set can_view = true, can_add = true, can_edit = true, can_delete = true
from public.role_templates t
where rtp.template_id = t.id
  and t.key = 'owner';

update public.role_template_permissions rtp
set
  can_view = v.can_view,
  can_add = v.can_add,
  can_edit = v.can_edit,
  can_delete = v.can_delete
from public.role_templates t
join (
  values
    ('accountant', 'dashboard', true, false, false, false),
    ('accountant', 'leads', true, false, false, false),
    ('accountant', 'clients', true, true, true, false),
    ('accountant', 'projects', true, true, true, false),
    ('accountant', 'backlog', true, false, false, false),
    ('accountant', 'purchase_orders', true, true, true, false),
    ('accountant', 'vendors', true, true, true, false),
    ('accountant', 'vendor_payments', true, true, false, false),
    ('accountant', 'accounts_payable', true, true, false, false),
    ('accountant', 'client_invoices', true, true, true, false),
    ('accountant', 'accounts_receivable', true, false, false, false),
    ('accountant', 'income', true, false, false, false),
    ('accountant', 'expense', true, false, false, false),
    ('accountant', 'expenses', true, true, true, false),
    ('accountant', 'banking', true, true, true, false),
    ('accountant', 'vat_tax', true, false, false, false),
    ('accountant', 'budgets', true, true, false, false),
    ('accountant', 'assets', true, false, false, false),
    ('accountant', 'employees', true, false, false, false),
    ('accountant', 'payroll', true, false, false, false),
    ('staff', 'dashboard', true, false, false, false),
    ('staff', 'leads', true, true, true, false),
    ('staff', 'clients', true, false, false, false),
    ('staff', 'projects', true, false, false, false),
    ('staff', 'backlog', true, true, true, false),
    ('staff', 'purchase_orders', true, false, false, false),
    ('staff', 'vendors', true, false, false, false),
    ('staff', 'employees', true, false, false, false)
) as v(role_key, module, can_view, can_add, can_edit, can_delete)
  on t.key = v.role_key
where rtp.template_id = t.id
  and rtp.module = v.module;

-- Helpers live in private so PostgREST does not expose them as RPC.
create or replace function private.is_active_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.status <> 'deactivated'
  );
$$;

create or replace function private.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'owner'
      and p.status = 'active'
  );
$$;

create or replace function private.has_erp_role(allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = any (allowed_roles)
      and p.status <> 'deactivated'
  );
$$;

create or replace function private.can(p_module text, p_action text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  profile_role text;
  profile_status text;
  owners_only boolean;
begin
  if auth.uid() is null then
    return false;
  end if;

  if p_action not in ('view', 'add', 'edit', 'delete') then
    return false;
  end if;

  select p.role, p.status
  into profile_role, profile_status
  from public.profiles p
  where p.id = auth.uid();

  if profile_role is null or profile_status = 'deactivated' then
    return false;
  end if;

  if profile_role = 'owner' and profile_status = 'active' then
    return true;
  end if;

  select m.owners_only
  into owners_only
  from public.permission_modules m
  where m.key = p_module;

  if owners_only is null or owners_only then
    return false;
  end if;

  return exists (
    select 1
    from public.user_permissions up
    where up.user_id = auth.uid()
      and up.module = p_module
      and (
        (p_action = 'view' and up.can_view)
        or (p_action = 'add' and up.can_add)
        or (p_action = 'edit' and up.can_edit)
        or (p_action = 'delete' and up.can_delete)
      )
  );
end;
$$;

revoke all on function private.is_active_member() from public, anon;
revoke all on function private.is_owner() from public, anon;
revoke all on function private.has_erp_role(text[]) from public, anon;
revoke all on function private.can(text, text) from public, anon;

grant execute on function private.is_active_member() to authenticated;
grant execute on function private.is_owner() to authenticated;
grant execute on function private.has_erp_role(text[]) to authenticated;
grant execute on function private.can(text, text) to authenticated;

create or replace function private.guard_profile_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  active_owners integer;
begin
  if tg_op = 'DELETE' then
    if auth.uid() is not null and auth.uid() = old.id then
      raise exception 'You cannot change your own role or permissions';
    end if;

    if old.role = 'owner' and old.status = 'active' then
      select count(*)
      into active_owners
      from public.profiles
      where role = 'owner'
        and status = 'active'
        and id <> old.id;

      if active_owners < 1 then
        raise exception 'At least one active owner must remain';
      end if;
    end if;

    return old;
  end if;

  if auth.uid() is not null and auth.uid() = new.id then
    if new.role is distinct from old.role
      or new.show_financials is distinct from old.show_financials
      or (
        new.status is distinct from old.status
        and not (old.status = 'invited' and new.status = 'active')
      )
    then
      raise exception 'You cannot change your own role or permissions';
    end if;
  end if;

  if old.role = 'owner'
    and old.status = 'active'
    and (new.role <> 'owner' or new.status <> 'active')
  then
    select count(*)
    into active_owners
    from public.profiles
    where role = 'owner'
      and status = 'active'
      and id <> old.id;

    if active_owners < 1 then
      raise exception 'At least one active owner must remain';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_access on public.profiles;
create trigger profiles_guard_access
  before update or delete on public.profiles
  for each row execute function private.guard_profile_change();

create or replace function private.guard_own_permissions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid;
begin
  target := coalesce(new.user_id, old.user_id);

  if auth.uid() is not null and auth.uid() = target then
    raise exception 'You cannot change your own permissions';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists user_permissions_guard_self on public.user_permissions;
create trigger user_permissions_guard_self
  before insert or update or delete on public.user_permissions
  for each row execute function private.guard_own_permissions();

create or replace function private.guard_project_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or private.can('projects', 'edit') then
    return new;
  end if;

  if private.can('backlog', 'edit')
    and (to_jsonb(new) - 'recovery_plan' - 'updated_at')
      is not distinct from (to_jsonb(old) - 'recovery_plan' - 'updated_at')
  then
    return new;
  end if;

  raise exception 'You do not have permission to edit this project';
end;
$$;

drop trigger if exists projects_guard_columns on public.projects;
create trigger projects_guard_columns
  before update on public.projects
  for each row execute function private.guard_project_columns();

create or replace function private.handle_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_role text;
begin
  if tg_op = 'INSERT' then
    next_role := coalesce(new.raw_user_meta_data ->> 'role', 'staff');
    if next_role not in ('owner', 'accountant', 'staff', 'custom') then
      next_role := 'staff';
    end if;

    insert into public.profiles (
      id,
      email,
      display_name,
      role,
      status,
      show_financials,
      last_sign_in_at
    )
    values (
      new.id,
      new.email,
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      next_role,
      case when new.last_sign_in_at is null then 'invited' else 'active' end,
      coalesce((new.raw_user_meta_data ->> 'show_financials')::boolean, false),
      new.last_sign_in_at
    )
    on conflict (id) do update
    set email = excluded.email,
        last_sign_in_at = excluded.last_sign_in_at;

    return new;
  end if;

  update public.profiles
  set
    email = new.email,
    last_sign_in_at = new.last_sign_in_at,
    status = case
      when status = 'invited' and new.last_sign_in_at is not null then 'active'
      else status
    end
  where id = new.id;

  return new;
end;
$$;

do $$
begin
  drop trigger if exists on_auth_user_write on auth.users;
  create trigger on_auth_user_write
    after insert or update of email, last_sign_in_at on auth.users
    for each row execute function private.handle_auth_user();
exception
  when insufficient_privilege then
    raise notice 'auth.users trigger skipped: %', sqlerrm;
end $$;

create or replace function private.log_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  row_id text;
  verb text;
begin
  if tg_op = 'DELETE' then
    row_id := old.id::text;
    verb := 'delete';
  elsif tg_op = 'UPDATE' then
    row_id := new.id::text;
    verb := 'update';
  else
    row_id := new.id::text;
    verb := 'insert';
  end if;

  insert into public.activity_log (
    actor_id,
    action,
    module,
    table_name,
    record_id,
    summary
  )
  values (
    auth.uid(),
    verb,
    tg_argv[0],
    tg_table_name,
    row_id,
    case verb
      when 'insert' then 'Added'
      when 'update' then 'Updated'
      else 'Deleted'
    end || ' ' || tg_argv[1]
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

-- Replace every permissive policy with per-command checks.
do $$
declare
  pol record;
begin
  for pol in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

create or replace procedure private.apply_crud(tbl text, readers text[], writer text)
language plpgsql
as $$
declare
  reader_expr text;
begin
  select string_agg(format('private.can(%L, %L)', reader, 'view'), ' or ')
  into reader_expr
  from unnest(readers) as reader;

  execute format('alter table public.%I enable row level security', tbl);
  execute format(
    'create policy %I on public.%I for select to authenticated using (%s)',
    tbl || '_select',
    tbl,
    reader_expr
  );
  execute format(
    'create policy %I on public.%I for insert to authenticated with check (private.can(%L, %L))',
    tbl || '_insert',
    tbl,
    writer,
    'add'
  );
  execute format(
    'create policy %I on public.%I for update to authenticated using (private.can(%L, %L)) with check (private.can(%L, %L))',
    tbl || '_update',
    tbl,
    writer,
    'edit',
    writer,
    'edit'
  );
  execute format(
    'create policy %I on public.%I for delete to authenticated using (private.can(%L, %L))',
    tbl || '_delete',
    tbl,
    writer,
    'delete'
  );
end;
$$;

create or replace procedure private.apply_lookup(tbl text)
language plpgsql
as $$
begin
  execute format('alter table public.%I enable row level security', tbl);
  execute format(
    'create policy %I on public.%I for select to authenticated using (private.is_active_member())',
    tbl || '_select',
    tbl
  );
  execute format(
    'create policy %I on public.%I for insert to authenticated with check (private.is_owner())',
    tbl || '_insert',
    tbl
  );
  execute format(
    'create policy %I on public.%I for update to authenticated using (private.is_owner()) with check (private.is_owner())',
    tbl || '_update',
    tbl
  );
  execute format(
    'create policy %I on public.%I for delete to authenticated using (private.is_owner())',
    tbl || '_delete',
    tbl
  );
end;
$$;

call private.apply_crud('leads', array['leads', 'dashboard'], 'leads');
call private.apply_crud('clients', array['clients', 'projects', 'accounts_receivable', 'income', 'backlog'], 'clients');
call private.apply_crud('projects', array['projects', 'backlog', 'clients', 'accounts_payable', 'accounts_receivable', 'income', 'banking', 'expenses', 'expense', 'vat_tax', 'purchase_orders', 'client_invoices', 'dashboard'], 'projects');
call private.apply_crud('vendors', array['vendors', 'purchase_orders', 'accounts_payable', 'expense'], 'vendors');
call private.apply_crud('vendor_purchase_orders', array['purchase_orders', 'accounts_payable', 'expense'], 'purchase_orders');
call private.apply_crud('vendor_invoices', array['vendor_payments', 'purchase_orders', 'accounts_payable', 'expense'], 'vendor_payments');
call private.apply_crud('vendor_payments', array['vendor_payments', 'accounts_payable', 'expense'], 'vendor_payments');
call private.apply_crud('client_invoices', array['client_invoices', 'accounts_receivable', 'income'], 'client_invoices');
call private.apply_crud('client_payments', array['client_invoices', 'accounts_receivable', 'income'], 'client_invoices');
call private.apply_crud('bank_accounts', array['banking'], 'banking');
call private.apply_crud('bank_transactions', array['banking'], 'banking');
call private.apply_crud('bank_transfers', array['banking'], 'banking');
call private.apply_crud('operational_expenses', array['expenses', 'budgets'], 'expenses');
call private.apply_crud('vat_tax_payments', array['vat_tax'], 'vat_tax');
call private.apply_crud('budgets', array['budgets'], 'budgets');
call private.apply_crud('assets', array['assets'], 'assets');
call private.apply_crud('employees', array['employees', 'payroll', 'budgets'], 'employees');
call private.apply_crud('payroll_runs', array['payroll', 'budgets'], 'payroll');
call private.apply_crud('payroll_lines', array['payroll', 'budgets'], 'payroll');

drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects
  for update to authenticated
  using (private.can('projects', 'edit') or private.can('backlog', 'edit'))
  with check (private.can('projects', 'edit') or private.can('backlog', 'edit'));

call private.apply_lookup('departments');
call private.apply_lookup('lead_sources');
call private.apply_lookup('lead_stages');
call private.apply_lookup('lead_statuses');
call private.apply_lookup('lead_types');
call private.apply_lookup('office_expense_categories');
call private.apply_lookup('payment_methods');
call private.apply_lookup('project_expense_categories');
call private.apply_lookup('project_phases');
call private.apply_lookup('project_types');
call private.apply_lookup('vendor_work_categories');

alter table public.company_settings enable row level security;
create policy company_settings_select on public.company_settings
  for select to authenticated
  using (private.is_active_member());
create policy company_settings_insert on public.company_settings
  for insert to authenticated
  with check (private.is_owner());
create policy company_settings_update on public.company_settings
  for update to authenticated
  using (private.is_owner())
  with check (private.is_owner());
create policy company_settings_delete on public.company_settings
  for delete to authenticated
  using (private.is_owner());

alter table public.profiles enable row level security;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or private.is_owner());
create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (private.is_owner());
create policy profiles_update on public.profiles
  for update to authenticated
  using (private.is_owner())
  with check (private.is_owner());
create policy profiles_delete on public.profiles
  for delete to authenticated
  using (private.is_owner());

alter table public.permission_modules enable row level security;
create policy permission_modules_select on public.permission_modules
  for select to authenticated
  using (private.is_active_member());
create policy permission_modules_insert on public.permission_modules
  for insert to authenticated
  with check (private.is_owner());
create policy permission_modules_update on public.permission_modules
  for update to authenticated
  using (private.is_owner())
  with check (private.is_owner());
create policy permission_modules_delete on public.permission_modules
  for delete to authenticated
  using (private.is_owner());

alter table public.role_templates enable row level security;
create policy role_templates_select on public.role_templates
  for select to authenticated
  using (private.is_owner());
create policy role_templates_update on public.role_templates
  for update to authenticated
  using (private.is_owner())
  with check (private.is_owner());

alter table public.role_template_permissions enable row level security;
create policy role_template_permissions_select on public.role_template_permissions
  for select to authenticated
  using (private.is_owner());
create policy role_template_permissions_insert on public.role_template_permissions
  for insert to authenticated
  with check (private.is_owner());
create policy role_template_permissions_update on public.role_template_permissions
  for update to authenticated
  using (private.is_owner())
  with check (private.is_owner());
create policy role_template_permissions_delete on public.role_template_permissions
  for delete to authenticated
  using (private.is_owner());

alter table public.user_permissions enable row level security;
create policy user_permissions_select on public.user_permissions
  for select to authenticated
  using (user_id = auth.uid() or private.is_owner());
create policy user_permissions_insert on public.user_permissions
  for insert to authenticated
  with check (private.is_owner());
create policy user_permissions_update on public.user_permissions
  for update to authenticated
  using (private.is_owner())
  with check (private.is_owner());
create policy user_permissions_delete on public.user_permissions
  for delete to authenticated
  using (private.is_owner());

alter table public.activity_log enable row level security;
create policy activity_log_select on public.activity_log
  for select to authenticated
  using (private.is_owner());

insert into public.user_permissions (
  user_id, module, can_view, can_add, can_edit, can_delete
)
select
  p.id,
  rtp.module,
  case when m.owners_only and p.role <> 'owner' then false else rtp.can_view end,
  case when m.owners_only and p.role <> 'owner' then false else rtp.can_add end,
  case when m.owners_only and p.role <> 'owner' then false else rtp.can_edit end,
  case when m.owners_only and p.role <> 'owner' then false else rtp.can_delete end
from public.profiles p
join public.role_templates t on t.key = p.role
join public.role_template_permissions rtp on rtp.template_id = t.id
join public.permission_modules m on m.key = rtp.module
on conflict (user_id, module) do update
set
  can_view = excluded.can_view,
  can_add = excluded.can_add,
  can_edit = excluded.can_edit,
  can_delete = excluded.can_delete;

do $$
declare
  item record;
begin
  for item in
    select *
    from (
      values
        ('client_invoices', 'client_invoices', 'Client Invoice'),
        ('client_payments', 'client_invoices', 'Client Payment'),
        ('vendor_invoices', 'vendor_payments', 'Vendor Invoice'),
        ('vendor_payments', 'vendor_payments', 'Vendor Payment'),
        ('vendor_purchase_orders', 'purchase_orders', 'Purchase Order'),
        ('bank_accounts', 'banking', 'Bank Account'),
        ('bank_transactions', 'banking', 'Bank Transaction'),
        ('bank_transfers', 'banking', 'Bank Transfer'),
        ('operational_expenses', 'expenses', 'Operational Expense'),
        ('vat_tax_payments', 'vat_tax', 'VAT/Tax Payment'),
        ('budgets', 'budgets', 'Budget'),
        ('payroll_runs', 'payroll', 'Payroll Run'),
        ('payroll_lines', 'payroll', 'Payroll Line'),
        ('assets', 'assets', 'Asset')
    ) as listed(table_name, module_key, label)
  loop
    execute format(
      'drop trigger if exists %I on public.%I',
      item.table_name || '_activity',
      item.table_name
    );
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function private.log_activity(%L, %L)',
      item.table_name || '_activity',
      item.table_name,
      item.module_key,
      item.label
    );
  end loop;
end $$;

revoke all on function public.has_erp_role(text[]) from public, anon, authenticated;
drop function public.has_erp_role(text[]);

revoke all privileges on all tables in schema public from anon;
revoke all privileges on all sequences in schema public from anon;

do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  loop
    begin
      execute format('revoke all privileges on function %s from anon', fn.signature);
    exception
      when insufficient_privilege then
        null;
    end;
  end loop;
end $$;

grant select, insert, update, delete on public.permission_modules to authenticated;
grant select, update on public.role_templates to authenticated;
grant select, insert, update, delete on public.role_template_permissions to authenticated;
grant select, insert, update, delete on public.user_permissions to authenticated;
grant select on public.activity_log to authenticated;

drop procedure if exists private.apply_crud(text, text[], text);
drop procedure if exists private.apply_lookup(text);
