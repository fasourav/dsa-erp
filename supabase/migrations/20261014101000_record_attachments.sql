-- Private files on business records.
-- View, edit, and delete follow the parent module's permissions.
-- This file is not applied by the app. Apply it with the normal migration flow.

create schema if not exists private;

create table if not exists public.record_attachments (
  id uuid primary key default gen_random_uuid(),
  parent_type text not null,
  parent_id uuid not null,
  file_name text not null,
  content_type text not null,
  byte_size integer not null,
  storage_path text not null unique,
  created_at timestamptz not null default now(),
  created_by uuid,
  constraint record_attachments_parent_type_check check (
    parent_type in (
      'client_invoice',
      'vendor_invoice',
      'purchase_order',
      'expense',
      'client_payment',
      'vendor_payment',
      'project',
      'client',
      'vendor',
      'employee',
      'asset',
      'bank_transaction',
      'quotation',
      'work_order',
      'issued_document'
    )
  ),
  constraint record_attachments_content_type_check check (
    content_type in (
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
  ),
  constraint record_attachments_byte_size_check check (byte_size > 0 and byte_size <= 10485760),
  constraint record_attachments_file_name_check check (char_length(btrim(file_name)) > 0)
);

create index if not exists record_attachments_parent_idx
  on public.record_attachments (parent_type, parent_id, created_at desc);

create or replace function private.attachment_module(p_type text, p_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  kind text;
begin
  if p_type = 'client_invoice' or p_type = 'client_payment' then
    return 'client_invoices';
  elsif p_type = 'vendor_invoice' or p_type = 'vendor_payment' then
    return 'vendor_payments';
  elsif p_type = 'purchase_order' then
    return 'purchase_orders';
  elsif p_type = 'expense' then
    return 'expenses';
  elsif p_type = 'project' then
    return 'projects';
  elsif p_type = 'client' then
    return 'clients';
  elsif p_type = 'vendor' then
    return 'vendors';
  elsif p_type = 'employee' then
    return 'employees';
  elsif p_type = 'asset' then
    return 'assets';
  elsif p_type = 'bank_transaction' then
    return 'banking';
  elsif p_type = 'quotation' then
    return 'quotations';
  elsif p_type = 'work_order' then
    return 'work_orders';
  elsif p_type = 'issued_document' then
    select d.kind into kind
    from public.issued_documents d
    where d.id = p_id;
    if kind = 'purchase_order' then
      return 'purchase_orders';
    elsif kind in ('invoice', 'receipt') then
      return 'client_invoices';
    end if;
  end if;
  return null;
end;
$$;

create or replace function private.attachment_parent_exists(p_type text, p_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_type = 'client_invoice' then
    return exists (select 1 from public.client_invoices where id = p_id);
  elsif p_type = 'vendor_invoice' then
    return exists (select 1 from public.vendor_invoices where id = p_id);
  elsif p_type = 'purchase_order' then
    return exists (select 1 from public.vendor_purchase_orders where id = p_id);
  elsif p_type = 'expense' then
    return exists (select 1 from public.operational_expenses where id = p_id);
  elsif p_type = 'client_payment' then
    return exists (select 1 from public.client_payments where id = p_id);
  elsif p_type = 'vendor_payment' then
    return exists (select 1 from public.vendor_payments where id = p_id);
  elsif p_type = 'project' then
    return exists (select 1 from public.projects where id = p_id);
  elsif p_type = 'client' then
    return exists (select 1 from public.clients where id = p_id);
  elsif p_type = 'vendor' then
    return exists (select 1 from public.vendors where id = p_id);
  elsif p_type = 'employee' then
    return exists (select 1 from public.employees where id = p_id);
  elsif p_type = 'asset' then
    return exists (select 1 from public.assets where id = p_id);
  elsif p_type = 'bank_transaction' then
    return exists (select 1 from public.bank_transactions where id = p_id);
  elsif p_type = 'quotation' then
    return exists (select 1 from public.quotations where id = p_id);
  elsif p_type = 'work_order' then
    return exists (select 1 from public.work_orders where id = p_id);
  elsif p_type = 'issued_document' then
    return exists (select 1 from public.issued_documents where id = p_id);
  end if;
  return false;
end;
$$;

create or replace function private.attachment_allowed(p_type text, p_id uuid, p_action text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  module_key text;
begin
  if auth.uid() is null or p_action not in ('view', 'edit', 'delete') then
    return false;
  end if;
  if not private.attachment_parent_exists(p_type, p_id) then
    return false;
  end if;
  module_key := private.attachment_module(p_type, p_id);
  if module_key is null then
    return false;
  end if;
  return private.can(module_key, p_action);
end;
$$;

create or replace function private.attachment_object_allowed(object_name text, p_action text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  folder text[];
  parent_type text;
  parent_id uuid;
begin
  folder := storage.foldername(object_name);
  if folder is null or cardinality(folder) < 2 then
    return false;
  end if;
  parent_type := folder[1];
  begin
    parent_id := folder[2]::uuid;
  exception
    when others then
      return false;
  end;
  return private.attachment_allowed(parent_type, parent_id, p_action);
end;
$$;

revoke all on function private.attachment_module(text, uuid) from public, anon, authenticated;
revoke all on function private.attachment_parent_exists(text, uuid) from public, anon, authenticated;
revoke all on function private.attachment_allowed(text, uuid, text) from public, anon;
revoke all on function private.attachment_object_allowed(text, text) from public, anon;
grant execute on function private.attachment_allowed(text, uuid, text) to authenticated;
grant execute on function private.attachment_object_allowed(text, text) to authenticated;

alter table public.record_attachments enable row level security;

drop policy if exists record_attachments_select on public.record_attachments;
create policy record_attachments_select on public.record_attachments
  for select to authenticated
  using (private.attachment_allowed(parent_type, parent_id, 'view'));

drop policy if exists record_attachments_insert on public.record_attachments;
create policy record_attachments_insert on public.record_attachments
  for insert to authenticated
  with check (private.attachment_allowed(parent_type, parent_id, 'edit'));

drop policy if exists record_attachments_update on public.record_attachments;
create policy record_attachments_update on public.record_attachments
  for update to authenticated
  using (private.attachment_allowed(parent_type, parent_id, 'edit'))
  with check (private.attachment_allowed(parent_type, parent_id, 'edit'));

drop policy if exists record_attachments_delete on public.record_attachments;
create policy record_attachments_delete on public.record_attachments
  for delete to authenticated
  using (private.attachment_allowed(parent_type, parent_id, 'delete'));

revoke all on table public.record_attachments from anon, public;
grant select, insert, update, delete on public.record_attachments to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'attachments',
  'attachments',
  false,
  10485760,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists attachments_select on storage.objects;
create policy attachments_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'attachments'
    and private.attachment_object_allowed(name, 'view')
  );

drop policy if exists attachments_insert on storage.objects;
create policy attachments_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and private.attachment_object_allowed(name, 'edit')
  );

drop policy if exists attachments_update on storage.objects;
create policy attachments_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'attachments'
    and private.attachment_object_allowed(name, 'edit')
  )
  with check (
    bucket_id = 'attachments'
    and private.attachment_object_allowed(name, 'edit')
  );

drop policy if exists attachments_delete on storage.objects;
create policy attachments_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'attachments'
    and private.attachment_object_allowed(name, 'delete')
  );

create or replace function private.log_record_attachment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  row_data jsonb;
  verb text;
  module_key text;
begin
  begin
    if tg_op = 'DELETE' then
      verb := 'delete';
      row_data := to_jsonb(old);
    else
      verb := 'insert';
      row_data := to_jsonb(new);
    end if;
    module_key := coalesce(
      private.attachment_module(row_data->>'parent_type', nullif(row_data->>'parent_id', '')::uuid),
      'settings'
    );
    insert into public.activity_log (
      actor_id, action, module, table_name, record_id, record_label, summary, old_values, new_values
    )
    values (
      auth.uid(),
      verb,
      module_key,
      'record_attachments',
      row_data->>'id',
      nullif(btrim(row_data->>'file_name'), ''),
      case when verb = 'insert' then 'Added' else 'Deleted' end
        || ' ' || coalesce(nullif(btrim(row_data->>'file_name'), ''), 'File'),
      case when verb = 'delete' then row_data else null end,
      case when verb = 'insert' then row_data else null end
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

drop trigger if exists record_attachments_activity on public.record_attachments;
create trigger record_attachments_activity
  after insert or delete on public.record_attachments
  for each row execute function private.log_record_attachment();

revoke all on function private.log_record_attachment() from public, anon, authenticated;
