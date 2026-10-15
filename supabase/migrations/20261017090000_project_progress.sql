-- Project progress tracking.
-- Adds stage and milestone tables, a settings template, and projects.progress_percent.
-- The new trigger writes only projects.progress_percent. It does not touch
-- current_phase, financial tables, or existing triggers.
-- This file is not applied by the app. Apply it with the normal migration flow.

insert into public.permission_modules (key, label, sort_order, owners_only)
values ('project_progress', 'Project Progress', 42, false)
on conflict (key) do update
set label = excluded.label,
    sort_order = excluded.sort_order,
    owners_only = excluded.owners_only;

insert into public.role_template_permissions (
  template_id, module, can_view, can_add, can_edit, can_delete
)
select t.id, 'project_progress', false, false, false, false
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
  and target.module = 'project_progress'
  and source.module = 'projects';

insert into public.user_permissions (
  user_id, module, can_view, can_add, can_edit, can_delete
)
select user_id, 'project_progress', can_view, can_add, can_edit, can_delete
from public.user_permissions
where module = 'projects'
on conflict (user_id, module) do nothing;

create type public.project_stage_status as enum (
  'Not Started',
  'In Progress',
  'Done'
);

alter table public.projects
  add column progress_percent numeric(6, 2) not null default 0;

alter table public.projects
  drop constraint if exists projects_progress_percent_check;

alter table public.projects
  add constraint projects_progress_percent_check
  check (progress_percent >= 0);

comment on column public.projects.progress_percent is
  'Completion percent maintained from project stages: full weight of Done stages plus half the weight of In Progress stages.';

create table public.project_stage_templates (
  id uuid primary key default gen_random_uuid(),
  sort_order integer not null check (sort_order >= 0),
  name text not null check (btrim(name) <> ''),
  weight numeric(6, 2) not null default 0 check (weight >= 0 and weight <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index project_stage_templates_name_idx
  on public.project_stage_templates (lower(name));

create table public.project_stages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  sort_order integer not null check (sort_order >= 0),
  name text not null check (btrim(name) <> ''),
  weight numeric(6, 2) not null default 0 check (weight >= 0 and weight <= 100),
  status public.project_stage_status not null default 'Not Started',
  planned_start date,
  planned_end date,
  done_on date,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (planned_end is null or planned_start is null or planned_end >= planned_start)
);

create index project_stages_project_idx
  on public.project_stages (project_id, sort_order);

create table public.project_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  stage_id uuid references public.project_stages (id) on delete set null,
  work_order_milestone_id uuid references public.work_order_milestones (id) on delete set null,
  label text not null check (btrim(label) <> ''),
  due_on date,
  done_on date,
  percent_of_value numeric(6, 2) check (
    percent_of_value is null or (percent_of_value >= 0 and percent_of_value <= 100)
  ),
  amount numeric(14, 2) check (amount is null or amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index project_milestones_project_idx
  on public.project_milestones (project_id, due_on);

create unique index project_milestones_work_order_uidx
  on public.project_milestones (project_id, work_order_milestone_id)
  where work_order_milestone_id is not null;

comment on column public.project_milestones.work_order_milestone_id is
  'Set when the row was copied from a work order milestone. Work order rows stay read-only.';

insert into public.project_stage_templates (sort_order, name, weight)
values
  (1, 'Concept', 10),
  (2, 'Design', 15),
  (3, 'Approval', 10),
  (4, 'Working Drawings', 20),
  (5, 'Construction Supervision', 35),
  (6, 'Handover', 10);

create or replace function private.write_project_progress(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  pct numeric;
begin
  if target is null then
    return;
  end if;

  select coalesce(sum(
    case status
      when 'Done' then weight
      when 'In Progress' then weight * 0.5
      else 0
    end
  ), 0)
  into pct
  from public.project_stages
  where project_id = target;

  update public.projects
  set progress_percent = round(pct, 2)
  where id = target
    and progress_percent is distinct from round(pct, 2);
end;
$$;

create or replace function private.refresh_project_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform private.write_project_progress(old.project_id);
    return old;
  end if;

  perform private.write_project_progress(new.project_id);
  if tg_op = 'UPDATE' and old.project_id is distinct from new.project_id then
    perform private.write_project_progress(old.project_id);
  end if;
  return new;
end;
$$;

drop trigger if exists project_stages_refresh_progress on public.project_stages;
create trigger project_stages_refresh_progress
  after insert or update or delete on public.project_stages
  for each row execute function private.refresh_project_progress();

create or replace function private.log_project_progress()
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
      when 'project_stage_templates' then 'settings'
      else 'project_progress'
    end;

    row_id := row_data->>'id';
    label := coalesce(
      nullif(btrim(row_data->>'name'), ''),
      nullif(btrim(row_data->>'label'), ''),
      'Record'
    );

    if tg_op = 'INSERT' then
      new_row := to_jsonb(new) - 'updated_at';
      changed_old := null;
      changed_new := new_row;
    elsif tg_op = 'DELETE' then
      old_row := to_jsonb(old) - 'updated_at';
      changed_old := old_row;
      changed_new := null;
    else
      new_row := to_jsonb(new) - 'updated_at';
      old_row := to_jsonb(old) - 'updated_at';
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

drop trigger if exists project_stage_templates_activity on public.project_stage_templates;
create trigger project_stage_templates_activity
  after insert or update or delete on public.project_stage_templates
  for each row execute function private.log_project_progress();

drop trigger if exists project_stages_activity on public.project_stages;
create trigger project_stages_activity
  after insert or update or delete on public.project_stages
  for each row execute function private.log_project_progress();

drop trigger if exists project_milestones_activity on public.project_milestones;
create trigger project_milestones_activity
  after insert or update or delete on public.project_milestones
  for each row execute function private.log_project_progress();

alter table public.project_stage_templates enable row level security;
alter table public.project_stages enable row level security;
alter table public.project_milestones enable row level security;

create policy project_stage_templates_select on public.project_stage_templates
  for select to authenticated
  using (
    private.can('settings', 'view')
    or private.can('project_progress', 'view')
    or private.can('projects', 'view')
  );
create policy project_stage_templates_insert on public.project_stage_templates
  for insert to authenticated
  with check (private.can('settings', 'add') or private.can('settings', 'edit'));
create policy project_stage_templates_update on public.project_stage_templates
  for update to authenticated
  using (private.can('settings', 'edit'))
  with check (private.can('settings', 'edit'));
create policy project_stage_templates_delete on public.project_stage_templates
  for delete to authenticated
  using (private.can('settings', 'delete') or private.can('settings', 'edit'));

create policy project_stages_select on public.project_stages
  for select to authenticated
  using (private.can('project_progress', 'view') or private.can('projects', 'view'));
create policy project_stages_insert on public.project_stages
  for insert to authenticated
  with check (
    private.can('project_progress', 'add')
    or private.can('project_progress', 'edit')
    or private.can('projects', 'add')
    or private.can('projects', 'edit')
  );
create policy project_stages_update on public.project_stages
  for update to authenticated
  using (private.can('project_progress', 'edit') or private.can('projects', 'edit'))
  with check (private.can('project_progress', 'edit') or private.can('projects', 'edit'));
create policy project_stages_delete on public.project_stages
  for delete to authenticated
  using (
    private.can('project_progress', 'delete')
    or private.can('project_progress', 'edit')
    or private.can('projects', 'delete')
    or private.can('projects', 'edit')
  );

create policy project_milestones_select on public.project_milestones
  for select to authenticated
  using (private.can('project_progress', 'view') or private.can('projects', 'view'));
create policy project_milestones_insert on public.project_milestones
  for insert to authenticated
  with check (
    private.can('project_progress', 'add')
    or private.can('project_progress', 'edit')
    or private.can('projects', 'add')
    or private.can('projects', 'edit')
  );
create policy project_milestones_update on public.project_milestones
  for update to authenticated
  using (private.can('project_progress', 'edit') or private.can('projects', 'edit'))
  with check (private.can('project_progress', 'edit') or private.can('projects', 'edit'));
create policy project_milestones_delete on public.project_milestones
  for delete to authenticated
  using (
    private.can('project_progress', 'delete')
    or private.can('project_progress', 'edit')
    or private.can('projects', 'delete')
    or private.can('projects', 'edit')
  );

revoke all on table public.project_stage_templates from anon, public;
revoke all on table public.project_stages from anon, public;
revoke all on table public.project_milestones from anon, public;

grant select, insert, update, delete on public.project_stage_templates to authenticated;
grant select, insert, update, delete on public.project_stages to authenticated;
grant select, insert, update, delete on public.project_milestones to authenticated;

revoke all on function private.write_project_progress(uuid) from public, anon, authenticated;
revoke all on function private.refresh_project_progress() from public, anon, authenticated;
revoke all on function private.log_project_progress() from public, anon, authenticated;
grant execute on function private.write_project_progress(uuid) to current_user;
grant execute on function private.refresh_project_progress() to authenticated, service_role;
grant execute on function private.log_project_progress() to authenticated, service_role;

notify pgrst, 'reload schema';
