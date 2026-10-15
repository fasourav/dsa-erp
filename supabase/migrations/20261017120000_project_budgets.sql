-- Project budget lines and a budget-vs-actual view.
-- Actual is accrual: vendor bills on a project's purchase orders, plus
-- operational expenses tagged with that project. Committed is purchase-order
-- value that is not yet billed. Department budgets, AP, AR, and expense
-- totals are not changed.
-- Category is the project expense category whose name matches the purchase
-- order work type or the operational expense category. Anything else is
-- Uncategorised.
-- block_bills_over_budget stays false. Saving a bill is not blocked.
-- This file is not applied by the app. Apply it with the normal migration flow.

insert into public.permission_modules (key, label, sort_order, owners_only)
values ('project_budgets', 'Project Budgets', 175, false)
on conflict (key) do update
set label = excluded.label,
    sort_order = excluded.sort_order,
    owners_only = excluded.owners_only;

insert into public.role_template_permissions (
  template_id, module, can_view, can_add, can_edit, can_delete
)
select t.id, 'project_budgets', false, false, false, false
from public.role_templates t
on conflict (template_id, module) do nothing;

update public.role_template_permissions target
set
  can_view = source.can_view,
  can_add = source.can_add,
  can_edit = source.can_edit,
  can_delete = source.can_delete
from public.role_template_permissions source
where target.template_id = source.template_id
  and target.module = 'project_budgets'
  and source.module = 'projects';

insert into public.user_permissions (
  user_id, module, can_view, can_add, can_edit, can_delete
)
select user_id, 'project_budgets', can_view, can_add, can_edit, can_delete
from public.user_permissions
where module = 'projects'
on conflict (user_id, module) do nothing;

alter table public.company_settings
  add column if not exists block_bills_over_budget boolean not null default false;

comment on column public.company_settings.block_bills_over_budget is
  'Reserved and left false. Vendor bills are not blocked when a project is over budget.';

create table public.project_budget_lines (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  category_id uuid not null references public.project_expense_categories (id) on delete restrict,
  planned_amount numeric(14, 2) not null default 0 check (planned_amount >= 0),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_budget_lines_project_category_key unique (project_id, category_id)
);

create index project_budget_lines_project_idx
  on public.project_budget_lines (project_id);

comment on table public.project_budget_lines is
  'Planned amount for one project expense category. Does not change department budgets.';

create or replace function private.touch_project_budget_line()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists project_budget_lines_touch on public.project_budget_lines;
create trigger project_budget_lines_touch
  before update on public.project_budget_lines
  for each row
  execute function private.touch_project_budget_line();

revoke all on function private.touch_project_budget_line() from public, anon;
grant execute on function private.touch_project_budget_line() to authenticated;

create or replace function private.project_budget_actual_rows()
returns table (
  project_id uuid,
  category_id uuid,
  category_name text,
  actual_amount numeric,
  committed_amount numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with bill_lines as (
    select
      po.project_id,
      cat.id as category_id,
      coalesce(cat.name, 'Uncategorised') as category_name,
      vi.amount as actual_amount,
      0::numeric as committed_amount
    from public.vendor_invoices vi
    join public.vendor_purchase_orders po on po.id = vi.purchase_order_id
    left join public.project_expense_categories cat
      on btrim(coalesce(po.work_type, '')) <> ''
     and lower(btrim(cat.name)) = lower(btrim(po.work_type))
    where po.project_id is not null
      and vi.status is distinct from 'void'
  ),
  expense_lines as (
    select
      oe.project_id,
      cat.id as category_id,
      coalesce(cat.name, 'Uncategorised') as category_name,
      oe.amount as actual_amount,
      0::numeric as committed_amount
    from public.operational_expenses oe
    left join public.project_expense_categories cat
      on btrim(coalesce(oe.category, '')) <> ''
     and lower(btrim(cat.name)) = lower(btrim(oe.category))
    where oe.project_id is not null
  ),
  committed_lines as (
    select
      po.project_id,
      cat.id as category_id,
      coalesce(cat.name, 'Uncategorised') as category_name,
      0::numeric as actual_amount,
      greatest(po.total_value - coalesce(billed.amount, 0), 0) as committed_amount
    from public.vendor_purchase_orders po
    left join public.project_expense_categories cat
      on btrim(coalesce(po.work_type, '')) <> ''
     and lower(btrim(cat.name)) = lower(btrim(po.work_type))
    left join (
      select purchase_order_id, coalesce(sum(amount), 0) as amount
      from public.vendor_invoices
      where status is distinct from 'void'
      group by purchase_order_id
    ) billed on billed.purchase_order_id = po.id
    where po.project_id is not null
      and greatest(po.total_value - coalesce(billed.amount, 0), 0) > 0
  ),
  combined as (
    select * from bill_lines
    union all
    select * from expense_lines
    union all
    select * from committed_lines
  )
  select
    combined.project_id,
    combined.category_id,
    combined.category_name,
    coalesce(sum(combined.actual_amount), 0)::numeric(14, 2) as actual_amount,
    coalesce(sum(combined.committed_amount), 0)::numeric(14, 2) as committed_amount
  from combined
  group by combined.project_id, combined.category_id, combined.category_name
  having coalesce(sum(combined.actual_amount), 0) <> 0
      or coalesce(sum(combined.committed_amount), 0) <> 0;
$$;

revoke all on function private.project_budget_actual_rows() from public, anon, authenticated;

create or replace view public.project_budget_actual
with (security_invoker = false) as
select
  rows.project_id,
  p.name as project_name,
  rows.category_id,
  rows.category_name,
  (case when private.sees_money() then rows.actual_amount end)::numeric(14, 2) as actual_amount,
  (case when private.sees_money() then rows.committed_amount end)::numeric(14, 2) as committed_amount
from private.project_budget_actual_rows() rows
join public.projects p on p.id = rows.project_id
where private.can('projects', 'view')
   or private.can('project_budgets', 'view');

comment on view public.project_budget_actual is
  'Actual and committed spend by project and category. Actual sums vendor bills and project-tagged operational expenses. Anyone who can view projects can read it.';

alter table public.project_budget_lines enable row level security;

drop policy if exists project_budget_lines_select on public.project_budget_lines;
create policy project_budget_lines_select on public.project_budget_lines
  for select to authenticated
  using (
    private.can('project_budgets', 'view')
    or private.can('projects', 'view')
  );

drop policy if exists project_budget_lines_insert on public.project_budget_lines;
create policy project_budget_lines_insert on public.project_budget_lines
  for insert to authenticated
  with check (private.can('project_budgets', 'add'));

drop policy if exists project_budget_lines_update on public.project_budget_lines;
create policy project_budget_lines_update on public.project_budget_lines
  for update to authenticated
  using (private.can('project_budgets', 'edit'))
  with check (private.can('project_budgets', 'edit'));

drop policy if exists project_budget_lines_delete on public.project_budget_lines;
create policy project_budget_lines_delete on public.project_budget_lines
  for delete to authenticated
  using (private.can('project_budgets', 'delete'));

revoke all on table public.project_budget_lines from public, anon;
revoke all on table public.project_budget_actual from public, anon;
grant select, insert, update, delete on public.project_budget_lines to authenticated;
grant select on public.project_budget_actual to authenticated;

notify pgrst, 'reload schema';
