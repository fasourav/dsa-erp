-- Direct save_vendor permission cases against RLS, not the server-action guard.
-- Self-contained: builds the vendor policies, applies the original function,
-- shows that a visible non-editor used to get 40001, then applies the forward
-- migration and checks the corrected codes.
--
-- psql -v ON_ERROR_STOP=1 -f supabase/tests/save_vendor_permissions.sql

\set ON_ERROR_STOP on

begin;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;

create schema if not exists auth;
create schema if not exists private;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create or replace function private.can(p_module text, p_action text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (',' || coalesce(current_setting('test.perms', true), '') || ',')
    like ('%,' || p_module || '.' || p_action || ',%')
$$;

create or replace function private.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select current_setting('test.is_owner', true) = 'on'
$$;

grant usage on schema auth, private, public to authenticated;
grant execute on function auth.uid() to authenticated;
grant execute on function private.can(text, text) to authenticated;
grant execute on function private.is_owner() to authenticated;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'vendor_kind') then
    create type public.vendor_kind as enum ('private', 'company');
  end if;
end $$;

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  kind public.vendor_kind not null,
  person_name text,
  company_name text,
  vendor_field text,
  email text,
  phone text,
  address text,
  notes text,
  updated_at timestamptz not null default clock_timestamp()
);

create table if not exists public.vendor_work_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null
);

create unique index if not exists vendor_work_categories_name_normalized_key
  on public.vendor_work_categories (lower(trim(name)));

create or replace function private.guard_record_version()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  if new.updated_at is distinct from old.updated_at then
    raise exception 'This record was changed by someone else — reload.' using errcode = '40001';
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists vendors_version on public.vendors;
create trigger vendors_version
  before update on public.vendors
  for each row execute function private.guard_record_version();

grant select, insert, update, delete on public.vendors to authenticated;
grant select, insert, update, delete on public.vendor_work_categories to authenticated;

alter table public.vendors enable row level security;
alter table public.vendor_work_categories enable row level security;
alter table public.vendors force row level security;
alter table public.vendor_work_categories force row level security;

drop policy if exists vendors_select on public.vendors;
drop policy if exists vendors_insert on public.vendors;
drop policy if exists vendors_update on public.vendors;
drop policy if exists vendors_delete on public.vendors;
create policy vendors_select on public.vendors
  for select to authenticated
  using (
    private.can('vendors', 'view')
    or private.can('purchase_orders', 'view')
    or private.can('accounts_payable', 'view')
    or private.can('expense', 'view')
  );
create policy vendors_insert on public.vendors
  for insert to authenticated
  with check (private.can('vendors', 'add'));
create policy vendors_update on public.vendors
  for update to authenticated
  using (private.can('vendors', 'edit'))
  with check (private.can('vendors', 'edit'));
create policy vendors_delete on public.vendors
  for delete to authenticated
  using (private.can('vendors', 'delete'));

drop policy if exists vendor_work_categories_select on public.vendor_work_categories;
drop policy if exists vendor_work_categories_insert on public.vendor_work_categories;
create policy vendor_work_categories_select on public.vendor_work_categories
  for select to authenticated
  using (true);
create policy vendor_work_categories_insert on public.vendor_work_categories
  for insert to authenticated
  with check (private.is_owner());

\ir ../migrations/20261106024500_atomic_save_vendor.sql

insert into public.vendors (
  id, kind, company_name, vendor_field, updated_at
) values (
  '00000000-0000-4000-8000-000000000001',
  'company',
  'Apex Builders',
  'Deleted Masonry',
  '2026-04-20 10:00:00+00'
);

insert into public.vendor_work_categories (name, sort_order)
values ('Electrical', 10);

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);

create or replace function pg_temp.expect_save(
  p_label text,
  p_sqlstate text,
  p_message_like text,
  p_id uuid,
  p_version timestamptz,
  p_kind public.vendor_kind,
  p_company text,
  p_field text
)
returns void
language plpgsql
as $$
declare
  v_state text;
  v_message text;
begin
  begin
    perform public.save_vendor(
      p_id, p_version, p_kind, null, p_company, p_field, null, null, null, null
    );
    v_state := 'OK';
    v_message := '';
  exception
    when others then
      get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
  end;

  if v_state is distinct from p_sqlstate then
    raise exception '%: expected %, got % (%)', p_label, p_sqlstate, v_state, v_message;
  end if;
  if p_message_like is not null and v_message not like p_message_like then
    raise exception '%: message % does not match %', p_label, v_message, p_message_like;
  end if;
end;
$$;

set local role authenticated;

-- Original function on PostgreSQL 16: SELECT FOR UPDATE applies the UPDATE
-- policy, so a purchase-order viewer who can see the vendor gets "not found".
select set_config('test.perms', 'purchase_orders.view', true);
select set_config('test.is_owner', 'off', true);
select pg_temp.expect_save(
  'original visible non-editor',
  'P0002',
  'That vendor could not be found.',
  '00000000-0000-4000-8000-000000000001',
  '2026-04-20 10:00:00+00',
  'company',
  'Apex Builders',
  'Deleted Masonry'
);

reset role;
\ir ../migrations/20261106024501_save_vendor_permission_denial.sql
set local role authenticated;

select pg_temp.expect_save(
  'fixed visible non-editor',
  '42501',
  'You do not have permission to edit vendors.',
  '00000000-0000-4000-8000-000000000001',
  '2026-04-20 10:00:00+00',
  'company',
  'Apex Builders',
  'deleted masonry'
);

select set_config('test.perms', '', true);
select pg_temp.expect_save(
  'hidden vendor',
  'P0002',
  'That vendor could not be found.',
  '00000000-0000-4000-8000-000000000001',
  '2026-04-20 10:00:00+00',
  'company',
  'Apex Builders',
  'Deleted Masonry'
);

select set_config('test.perms', 'vendors.view,vendors.edit', true);
select pg_temp.expect_save(
  'stale version',
  '40001',
  '%changed by someone else%',
  '00000000-0000-4000-8000-000000000001',
  '2000-01-01 00:00:00+00',
  'company',
  'Apex Builders',
  'Deleted Masonry'
);

select set_config('test.perms', 'vendors.view,vendors.edit', true);
select pg_temp.expect_save(
  'add denied',
  '42501',
  'You do not have permission to add vendors.',
  null,
  null,
  'company',
  'Blocked Vendor',
  'Electrical'
);

select set_config('test.perms', 'vendors.view,vendors.edit', true);
select pg_temp.expect_save(
  'non-owner new category',
  '42501',
  'Only owners can add new vendor categories.',
  '00000000-0000-4000-8000-000000000001',
  '2026-04-20 10:00:00+00',
  'company',
  'Apex Builders',
  'Solar Work'
);

-- can() allows edit, but the UPDATE policy does not. PostgreSQL 16 then
-- hides the row from SELECT FOR UPDATE. That stays "not found", not a
-- permission error, because private.can says the caller may edit.
reset role;
drop policy vendors_update on public.vendors;
create policy vendors_update on public.vendors
  for update to authenticated
  using (false)
  with check (false);
set local role authenticated;
select set_config('test.perms', 'vendors.view,vendors.edit', true);
select pg_temp.expect_save(
  'update policy false while can(edit)',
  'P0002',
  'That vendor could not be found.',
  '00000000-0000-4000-8000-000000000001',
  '2026-04-20 10:00:00+00',
  'company',
  'Apex Builders',
  'Deleted Masonry'
);

reset role;
drop policy vendors_update on public.vendors;
create policy vendors_update on public.vendors
  for update to authenticated
  using (private.can('vendors', 'edit'))
  with check (private.can('vendors', 'edit'));
reset role;

create or replace function public.skip_vendor_update()
returns trigger
language plpgsql
as $$
begin
  if current_setting('test.skip_update', true) = 'on' then
    return null;
  end if;
  return new;
end;
$$;
drop trigger if exists skip_vendor_update on public.vendors;
create trigger skip_vendor_update
  before update on public.vendors
  for each row execute function public.skip_vendor_update();
set local role authenticated;
select set_config('test.skip_update', 'on', true);
select set_config('test.perms', 'vendors.view,vendors.edit', true);
select pg_temp.expect_save(
  'trigger skips update while edit is allowed',
  '40001',
  '%changed by someone else%',
  '00000000-0000-4000-8000-000000000001',
  '2026-04-20 10:00:00+00',
  'company',
  'Apex Builders',
  'Deleted Masonry'
);
select set_config('test.skip_update', 'off', true);

do $$
declare
  v_saved jsonb;
  v_field text;
  v_categories integer;
begin
  perform set_config('test.perms', 'vendors.view,vendors.edit', true);
  perform set_config('test.is_owner', 'off', true);
  v_saved := public.save_vendor(
    '00000000-0000-4000-8000-000000000001',
    '2026-04-20 10:00:00+00',
    'company',
    null,
    'Apex Builders',
    '  deleted masonry ',
    null,
    '+8801711000099',
    'New Road',
    null
  );
  if v_saved->>'id' is null then
    raise exception 'historical edit returned no id';
  end if;
  select vendor_field into v_field
  from public.vendors
  where id = '00000000-0000-4000-8000-000000000001';
  if v_field is distinct from 'Deleted Masonry' then
    raise exception 'historical category changed to %', v_field;
  end if;
  select count(*) into v_categories
  from public.vendor_work_categories
  where lower(trim(name)) = 'deleted masonry';
  if v_categories <> 0 then
    raise exception 'historical category was recreated';
  end if;
end $$;

do $$
declare
  v_saved jsonb;
  v_count integer;
begin
  perform set_config('test.is_owner', 'on', true);
  perform set_config('test.perms', 'vendors.view,vendors.edit', true);
  v_saved := public.save_vendor(
    '00000000-0000-4000-8000-000000000001',
    (select updated_at from public.vendors where id = '00000000-0000-4000-8000-000000000001'),
    'company',
    null,
    'Apex Builders',
    'Solar Work',
    null,
    null,
    null,
    null
  );
  if v_saved->>'id' is null then
    raise exception 'owner category edit returned no id';
  end if;
  select count(*) into v_count
  from public.vendor_work_categories
  where lower(trim(name)) = 'solar work';
  if v_count <> 1 then
    raise exception 'owner category insert count %', v_count;
  end if;
  select count(*) into v_count from public.vendors;
  if v_count <> 1 then
    raise exception 'owner edit changed vendor count to %', v_count;
  end if;
end $$;

do $$
declare
  v_saved jsonb;
  v_count integer;
begin
  perform set_config('test.is_owner', 'off', true);
  perform set_config('test.perms', 'vendors.add,vendors.view', true);
  v_saved := public.save_vendor(
    null,
    null,
    'private',
    'Rahim',
    null,
    'Electrical',
    null,
    null,
    null,
    null
  );
  if v_saved->>'id' is null then
    raise exception 'add with existing category returned no id';
  end if;
  select count(*) into v_count from public.vendor_work_categories;
  if v_count <> 2 then
    raise exception 'existing category was duplicated, count %', v_count;
  end if;
end $$;

reset role;

do $$
declare
  v_field text;
begin
  select vendor_field into v_field
  from public.vendors
  where id = '00000000-0000-4000-8000-000000000001';
  if v_field is distinct from 'Solar Work' then
    raise exception 'final stored category %', v_field;
  end if;
end $$;

rollback;
