-- P-07. Staff without financials must not read money columns through the REST API.
-- Not applied to live by this change.
--
-- These base tables were still granted to authenticated, so a staff JWT could
-- select vendor_purchase_orders.total_value, work_orders.total,
-- project_milestones.amount, and project_budget_lines.planned_amount.
-- Column privileges cannot tell an owner from staff (both are authenticated).
-- The public name becomes a security-invoker view that nulls the money column
-- unless private.session_sees_money(). The table moves to private, which is
-- not an exposed API schema. Owners and service_role still receive the amount.
-- Existing SQL functions keep reading the private table so their calculations
-- stay on the real figures. Writes from the API go through INSTEAD OF triggers.

create or replace function private.session_sees_money()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select current_user in ('postgres', 'supabase_admin', 'service_role')
      or private.sees_money();
$$;

revoke all on function private.session_sees_money() from public, anon;
grant execute on function private.session_sees_money() to authenticated, service_role;

alter table public.vendor_purchase_orders set schema private;
alter table public.work_orders set schema private;
alter table public.project_milestones set schema private;
alter table public.project_budget_lines set schema private;

-- Point function bodies at the private tables. View definitions follow the
-- table by oid. String labels such as 'work_orders' are left unchanged.
do $$
declare
  fn regprocedure;
  def text;
begin
  for fn in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and (
        p.prosrc like '%public.vendor_purchase_orders%'
        or p.prosrc like '%public.work_orders%'
        or p.prosrc like '%public.project_milestones%'
        or p.prosrc like '%public.project_budget_lines%'
      )
  loop
    def := pg_get_functiondef(fn);
    def := replace(def, 'public.vendor_purchase_orders', 'private.vendor_purchase_orders');
    def := replace(def, 'public.work_orders', 'private.work_orders');
    def := replace(def, 'public.project_milestones', 'private.project_milestones');
    def := replace(def, 'public.project_budget_lines', 'private.project_budget_lines');
    execute def;
  end loop;
end
$$;

create or replace function private.vendor_purchase_orders_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  stored private.vendor_purchase_orders;
begin
  if tg_op = 'INSERT' then
    insert into private.vendor_purchase_orders (
      id, project_id, vendor_id, issued_on, work_type, total_value, notes, created_at, updated_at
    ) values (
      coalesce(new.id, pg_catalog.gen_random_uuid()),
      new.project_id,
      new.vendor_id,
      coalesce(new.issued_on, current_date),
      new.work_type,
      coalesce(new.total_value, 0),
      new.notes,
      coalesce(new.created_at, pg_catalog.now()),
      coalesce(new.updated_at, pg_catalog.now())
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
      updated_at = new.updated_at
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
$$;

create or replace function private.work_orders_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  stored private.work_orders;
begin
  if tg_op = 'INSERT' then
    insert into private.work_orders (
      id, document_no, issued_on, status, vendor_id, project_id, proposal_on, work_start, work_end,
      subject, introduction, terms, total, prepared_by, authorized_by, verify_token,
      created_at, updated_at, purchase_order_id
    ) values (
      coalesce(new.id, pg_catalog.gen_random_uuid()),
      new.document_no,
      new.issued_on,
      coalesce(new.status, 'draft'),
      new.vendor_id,
      new.project_id,
      new.proposal_on,
      new.work_start,
      new.work_end,
      coalesce(new.subject, ''),
      coalesce(new.introduction, ''),
      coalesce(new.terms, ''),
      coalesce(new.total, 0),
      coalesce(new.prepared_by, ''),
      coalesce(new.authorized_by, ''),
      new.verify_token,
      coalesce(new.created_at, pg_catalog.now()),
      coalesce(new.updated_at, pg_catalog.now()),
      new.purchase_order_id
    )
    returning * into stored;
  elsif tg_op = 'UPDATE' then
    update private.work_orders as row
    set
      document_no = new.document_no,
      issued_on = new.issued_on,
      status = new.status,
      vendor_id = new.vendor_id,
      project_id = new.project_id,
      proposal_on = new.proposal_on,
      work_start = new.work_start,
      work_end = new.work_end,
      subject = new.subject,
      introduction = new.introduction,
      terms = new.terms,
      total = case
        when private.session_sees_money() then new.total
        when new.total is null then row.total
        else new.total
      end,
      prepared_by = new.prepared_by,
      authorized_by = new.authorized_by,
      verify_token = new.verify_token,
      updated_at = new.updated_at,
      purchase_order_id = new.purchase_order_id
    where row.id = old.id
    returning * into stored;
    if not found then
      return null;
    end if;
  else
    delete from private.work_orders as row
    where row.id = old.id
    returning * into stored;
    if not found then
      return null;
    end if;
  end if;

  if not private.session_sees_money() then
    stored.total := null;
  end if;
  return stored;
end;
$$;

create or replace function private.project_milestones_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  stored private.project_milestones;
begin
  if tg_op = 'INSERT' then
    insert into private.project_milestones (
      id, project_id, stage_id, work_order_milestone_id, label, due_on, done_on,
      percent_of_value, amount, created_at, updated_at
    ) values (
      coalesce(new.id, pg_catalog.gen_random_uuid()),
      new.project_id,
      new.stage_id,
      new.work_order_milestone_id,
      new.label,
      new.due_on,
      new.done_on,
      new.percent_of_value,
      new.amount,
      coalesce(new.created_at, pg_catalog.now()),
      coalesce(new.updated_at, pg_catalog.now())
    )
    returning * into stored;
  elsif tg_op = 'UPDATE' then
    update private.project_milestones as row
    set
      project_id = new.project_id,
      stage_id = new.stage_id,
      work_order_milestone_id = new.work_order_milestone_id,
      label = new.label,
      due_on = new.due_on,
      done_on = new.done_on,
      percent_of_value = new.percent_of_value,
      amount = case
        when private.session_sees_money() then new.amount
        when new.amount is null then row.amount
        else new.amount
      end,
      updated_at = new.updated_at
    where row.id = old.id
    returning * into stored;
    if not found then
      return null;
    end if;
  else
    delete from private.project_milestones as row
    where row.id = old.id
    returning * into stored;
    if not found then
      return null;
    end if;
  end if;

  if not private.session_sees_money() then
    stored.amount := null;
  end if;
  return stored;
end;
$$;

create or replace function private.project_budget_lines_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  stored private.project_budget_lines;
begin
  if tg_op = 'INSERT' then
    insert into private.project_budget_lines (
      id, project_id, category_id, planned_amount, notes, created_at, updated_at
    ) values (
      coalesce(new.id, pg_catalog.gen_random_uuid()),
      new.project_id,
      new.category_id,
      coalesce(new.planned_amount, 0),
      coalesce(new.notes, ''),
      coalesce(new.created_at, pg_catalog.now()),
      coalesce(new.updated_at, pg_catalog.now())
    )
    returning * into stored;
  elsif tg_op = 'UPDATE' then
    update private.project_budget_lines as row
    set
      project_id = new.project_id,
      category_id = new.category_id,
      planned_amount = case
        when private.session_sees_money() then new.planned_amount
        when new.planned_amount is null then row.planned_amount
        else new.planned_amount
      end,
      notes = new.notes,
      updated_at = new.updated_at
    where row.id = old.id
    returning * into stored;
    if not found then
      return null;
    end if;
  else
    delete from private.project_budget_lines as row
    where row.id = old.id
    returning * into stored;
    if not found then
      return null;
    end if;
  end if;

  if not private.session_sees_money() then
    stored.planned_amount := null;
  end if;
  return stored;
end;
$$;

revoke all on function private.vendor_purchase_orders_write() from public, anon;
revoke all on function private.work_orders_write() from public, anon;
revoke all on function private.project_milestones_write() from public, anon;
revoke all on function private.project_budget_lines_write() from public, anon;
grant execute on function private.vendor_purchase_orders_write() to authenticated, service_role;
grant execute on function private.work_orders_write() to authenticated, service_role;
grant execute on function private.project_milestones_write() to authenticated, service_role;
grant execute on function private.project_budget_lines_write() to authenticated, service_role;

create view public.vendor_purchase_orders
with (security_invoker = true) as
select
  id,
  project_id,
  vendor_id,
  issued_on,
  work_type,
  (case when private.session_sees_money() then total_value end)::numeric(14, 2) as total_value,
  notes,
  created_at,
  updated_at
from private.vendor_purchase_orders;

create view public.work_orders
with (security_invoker = true) as
select
  id,
  document_no,
  issued_on,
  status,
  vendor_id,
  project_id,
  proposal_on,
  work_start,
  work_end,
  subject,
  introduction,
  terms,
  (case when private.session_sees_money() then total end)::numeric(14, 2) as total,
  prepared_by,
  authorized_by,
  verify_token,
  created_at,
  updated_at,
  purchase_order_id
from private.work_orders;

create view public.project_milestones
with (security_invoker = true) as
select
  id,
  project_id,
  stage_id,
  work_order_milestone_id,
  label,
  due_on,
  done_on,
  percent_of_value,
  (case when private.session_sees_money() then amount end)::numeric(14, 2) as amount,
  created_at,
  updated_at
from private.project_milestones;

create view public.project_budget_lines
with (security_invoker = true) as
select
  id,
  project_id,
  category_id,
  (case when private.session_sees_money() then planned_amount end)::numeric(14, 2) as planned_amount,
  notes,
  created_at,
  updated_at
from private.project_budget_lines;

comment on view public.vendor_purchase_orders is
  'Purchase orders. total_value is null unless the caller can see money. Writes update private.vendor_purchase_orders.';
comment on view public.work_orders is
  'Work orders. total is null unless the caller can see money. Writes update private.work_orders.';
comment on view public.project_milestones is
  'Project milestones. amount is null unless the caller can see money. Writes update private.project_milestones.';
comment on view public.project_budget_lines is
  'Project budget lines. planned_amount is null unless the caller can see money. Writes update private.project_budget_lines.';

create trigger vendor_purchase_orders_write
  instead of insert or update or delete on public.vendor_purchase_orders
  for each row execute function private.vendor_purchase_orders_write();

create trigger work_orders_write
  instead of insert or update or delete on public.work_orders
  for each row execute function private.work_orders_write();

create trigger project_milestones_write
  instead of insert or update or delete on public.project_milestones
  for each row execute function private.project_milestones_write();

create trigger project_budget_lines_write
  instead of insert or update or delete on public.project_budget_lines
  for each row execute function private.project_budget_lines_write();

revoke all on table private.vendor_purchase_orders from anon, public;
revoke all on table private.work_orders from anon, public;
revoke all on table private.project_milestones from anon, public;
revoke all on table private.project_budget_lines from anon, public;

revoke all on public.vendor_purchase_orders from public, anon;
revoke all on public.work_orders from public, anon;
revoke all on public.project_milestones from public, anon;
revoke all on public.project_budget_lines from public, anon;

grant select, insert, update, delete on public.vendor_purchase_orders to authenticated, service_role;
grant select, insert, update, delete on public.work_orders to authenticated, service_role;
grant select, insert, update, delete on public.project_milestones to authenticated, service_role;
grant select, insert, update, delete on public.project_budget_lines to authenticated, service_role;

notify pgrst, 'reload schema';
