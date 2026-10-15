-- Reusable quotation and work-order templates.
-- Applying a template copies text, lines, and milestones onto the document.
-- Later template edits do not change issued documents.
-- This file is not applied by the app. Apply it with the normal migration flow.

insert into public.permission_modules (key, label, sort_order, owners_only)
values ('document_templates', 'Document Templates', 66, false)
on conflict (key) do update
set label = excluded.label,
    sort_order = excluded.sort_order,
    owners_only = excluded.owners_only;

insert into public.role_template_permissions (
  template_id, module, can_view, can_add, can_edit, can_delete
)
select t.id, 'document_templates', false, false, false, false
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
  and target.module = 'document_templates'
  and source.module = 'quotations';

insert into public.user_permissions (
  user_id, module, can_view, can_add, can_edit, can_delete
)
select user_id, 'document_templates', can_view, can_add, can_edit, can_delete
from public.user_permissions
where module = 'quotations'
on conflict (user_id, module) do nothing;

create or replace function private.document_template_payload_ok(
  p_lines jsonb,
  p_milestones jsonb
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  line jsonb;
  milestone jsonb;
  total numeric := 0;
  qty numeric;
  rate numeric;
  percent numeric;
begin
  if jsonb_typeof(p_lines) is distinct from 'array' then
    return false;
  end if;
  if jsonb_typeof(p_milestones) is distinct from 'array' then
    return false;
  end if;

  for line in select value from jsonb_array_elements(p_lines)
  loop
    if jsonb_typeof(line) is distinct from 'object' then
      return false;
    end if;
    if coalesce(btrim(line->>'description'), '') = '' then
      return false;
    end if;
    if coalesce(btrim(line->>'unit'), '') = '' then
      return false;
    end if;
    qty := (line->>'qty')::numeric;
    rate := (line->>'rate')::numeric;
    if qty is null or qty <= 0 then
      return false;
    end if;
    if rate is null or rate < 0 then
      return false;
    end if;
  end loop;

  for milestone in select value from jsonb_array_elements(p_milestones)
  loop
    if jsonb_typeof(milestone) is distinct from 'object' then
      return false;
    end if;
    if coalesce(btrim(milestone->>'label'), '') = '' then
      return false;
    end if;
    percent := (milestone->>'percent')::numeric;
    if percent is null or percent < 0 or percent > 100 then
      return false;
    end if;
    total := total + percent;
  end loop;

  if jsonb_array_length(p_milestones) > 0 and abs(total - 100) > 0.05 then
    return false;
  end if;

  return true;
exception
  when others then
    return false;
end;
$$;

revoke all on function private.document_template_payload_ok(jsonb, jsonb)
  from public, anon;
-- The table check constraint calls this as the writing role, so authenticated needs execute.
grant execute on function private.document_template_payload_ok(jsonb, jsonb) to authenticated;

create table public.document_templates (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('quotation', 'work_order')),
  name text not null check (btrim(name) <> ''),
  project_type text,
  scope_text text not null default '',
  terms_text text not null default '',
  payment_terms text not null default '',
  lines jsonb not null default '[]'::jsonb,
  milestones jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_templates_project_type_check
    check (project_type is null or btrim(project_type) <> ''),
  constraint document_templates_payload_check
    check (private.document_template_payload_ok(lines, milestones))
);

-- Names are unique per kind ignoring case and surrounding spaces.
create unique index document_templates_kind_name_key
  on public.document_templates (kind, lower(btrim(name)));

comment on table public.document_templates is
  'Copied onto quotations and work orders. Issued documents keep their own text, lines, and milestones.';

create or replace function private.touch_document_template()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  new.name := btrim(new.name);
  if new.project_type is not null then
    new.project_type := nullif(btrim(new.project_type), '');
  end if;
  return new;
end;
$$;

drop trigger if exists document_templates_touch on public.document_templates;
create trigger document_templates_touch
  before insert or update on public.document_templates
  for each row execute function private.touch_document_template();

create or replace function private.log_document_templates()
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

    row_id := row_data->>'id';
    label := coalesce(nullif(btrim(row_data->>'name'), ''), 'Document Template');

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
      'document_templates',
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

revoke all on function private.touch_document_template() from public, anon, authenticated;
revoke all on function private.log_document_templates() from public, anon, authenticated;
grant execute on function private.log_document_templates() to authenticated, service_role;

drop trigger if exists document_templates_activity on public.document_templates;
create trigger document_templates_activity
  after insert or update or delete on public.document_templates
  for each row execute function private.log_document_templates();

alter table public.document_templates enable row level security;

create policy document_templates_select on public.document_templates
  for select to authenticated
  using (
    private.can('document_templates', 'view')
    or (
      is_active
      and (
        (kind = 'quotation' and private.can('quotations', 'add'))
        or (kind = 'work_order' and private.can('work_orders', 'add'))
      )
    )
  );

create policy document_templates_insert on public.document_templates
  for insert to authenticated
  with check (private.can('document_templates', 'add'));

create policy document_templates_update on public.document_templates
  for update to authenticated
  using (private.can('document_templates', 'edit'))
  with check (private.can('document_templates', 'edit'));

create policy document_templates_delete on public.document_templates
  for delete to authenticated
  using (private.can('document_templates', 'delete'));

revoke all on table public.document_templates from public, anon;
grant select, insert, update, delete on public.document_templates to authenticated;

notify pgrst, 'reload schema';
