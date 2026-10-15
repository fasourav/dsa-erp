-- Automatic daily backup log and owners-only status.
-- This file is not applied by the app. Apply it with the normal migration flow.

insert into public.permission_modules (key, label, sort_order, owners_only)
values ('backups', 'Backups', 225, true)
on conflict (key) do update
set label = excluded.label,
    sort_order = excluded.sort_order,
    owners_only = excluded.owners_only;

insert into public.role_template_permissions (
  template_id, module, can_view, can_add, can_edit, can_delete
)
select t.id, 'backups', false, false, false, false
from public.role_templates t
on conflict (template_id, module) do nothing;

create table public.backup_runs (
  id uuid primary key default gen_random_uuid(),
  ran_at timestamptz not null default now(),
  size_bytes bigint,
  status text not null,
  error text,
  storage_path text,
  constraint backup_runs_status_check
    check (status in ('ok', 'error')),
  constraint backup_runs_size_bytes_check
    check (size_bytes is null or size_bytes >= 0)
);

create index backup_runs_ran_at_idx
  on public.backup_runs (ran_at desc);

alter table public.backup_runs enable row level security;

create policy backup_runs_select on public.backup_runs
  for select to authenticated
  using (private.can('backups', 'view'));

create policy backup_runs_insert on public.backup_runs
  for insert to authenticated
  with check (private.can('backups', 'add'));

create policy backup_runs_update on public.backup_runs
  for update to authenticated
  using (private.can('backups', 'edit'))
  with check (private.can('backups', 'edit'));

create policy backup_runs_delete on public.backup_runs
  for delete to authenticated
  using (private.can('backups', 'delete'));

revoke all on table public.backup_runs from public, anon;
grant select, insert, update, delete on public.backup_runs to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'backups',
  'backups',
  false,
  209715200,
  array['application/zip', 'application/octet-stream']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

notify pgrst, 'reload schema';
