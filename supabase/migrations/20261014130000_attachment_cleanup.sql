-- Remove a record's attachments when the record is deleted.
-- record_attachments links to its parent by (parent_type, parent_id) with no foreign key,
-- so deleting a parent left its rows behind (hidden by RLS, because the policies need the
-- parent to exist) and left the files in Storage.
--
-- 1. A statement trigger on every parent table deletes the matching attachment rows inside
--    the parent's own transaction. Cascaded deletes (for example a payment's bank
--    transaction) fire it too. The parent delete already passed the parent's RLS, so the
--    trigger runs as definer and a cleanup failure only raises a warning.
-- 2. Deleting an attachment row queues its storage path. Supabase blocks SQL deletes on
--    storage.objects, so the app removes queued files through the Storage API and then
--    settles the queue. Settling only forgets paths whose object is really gone.
-- 3. Files can be removed by the user who queued them, an owner, or the service role.
--    A file is removable only while it is queued and no attachment row points at it.
--
-- This file is not applied by the app. Apply it with the normal migration flow.

create schema if not exists private;

create table if not exists private.attachment_file_purges (
  storage_path text primary key,
  queued_by uuid,
  queued_at timestamptz not null default now(),
  attempts integer not null default 0,
  last_tried_at timestamptz
);

create index if not exists attachment_file_purges_queued_by_idx
  on private.attachment_file_purges (queued_by, queued_at);

alter table private.attachment_file_purges enable row level security;
revoke all on table private.attachment_file_purges from public, anon, authenticated, service_role;

create or replace function private.queue_attachment_files()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    insert into private.attachment_file_purges (storage_path, queued_by)
    select o.storage_path, auth.uid()
    from old_rows o
    on conflict (storage_path) do nothing;
  exception
    when others then
      raise warning 'Could not queue attachment files for removal: %', sqlerrm;
  end;
  return null;
end;
$$;

revoke all on function private.queue_attachment_files() from public, anon, authenticated, service_role;

drop trigger if exists record_attachments_queue_files on public.record_attachments;
create trigger record_attachments_queue_files
  after delete on public.record_attachments
  referencing old table as old_rows
  for each statement execute function private.queue_attachment_files();

create or replace function private.delete_parent_attachments()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    delete from public.record_attachments a
    using old_rows o
    where a.parent_type = tg_argv[0]
      and a.parent_id = o.id;
  exception
    when others then
      raise warning 'Could not delete % attachments: %', tg_argv[0], sqlerrm;
  end;
  return null;
end;
$$;

revoke all on function private.delete_parent_attachments() from public, anon, authenticated, service_role;

do $$
declare
  link record;
begin
  for link in
    select *
    from (
      values
        ('client_invoice', 'client_invoices'),
        ('vendor_invoice', 'vendor_invoices'),
        ('purchase_order', 'vendor_purchase_orders'),
        ('expense', 'operational_expenses'),
        ('client_payment', 'client_payments'),
        ('vendor_payment', 'vendor_payments'),
        ('project', 'projects'),
        ('client', 'clients'),
        ('vendor', 'vendors'),
        ('employee', 'employees'),
        ('asset', 'assets'),
        ('bank_transaction', 'bank_transactions'),
        ('quotation', 'quotations'),
        ('work_order', 'work_orders'),
        ('issued_document', 'issued_documents')
    ) as v(parent_type, table_name)
  loop
    execute format('drop trigger if exists record_attachments_cleanup on public.%I', link.table_name);
    execute format(
      'create trigger record_attachments_cleanup after delete on public.%I '
        || 'referencing old table as old_rows for each statement '
        || 'execute function private.delete_parent_attachments(%L)',
      link.table_name,
      link.parent_type
    );
  end loop;
end;
$$;

create or replace function private.attachment_file_purgeable(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from private.attachment_file_purges q
      where q.storage_path = object_name
        and (q.queued_by = auth.uid() or private.is_owner())
    )
    and not exists (
      select 1
      from public.record_attachments a
      where a.storage_path = object_name
    );
$$;

revoke all on function private.attachment_file_purgeable(text) from public, anon;
grant execute on function private.attachment_file_purgeable(text) to authenticated;

-- Storage remove() needs both select and delete on the object.
drop policy if exists attachments_select on storage.objects;
create policy attachments_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'attachments'
    and (
      private.attachment_object_allowed(name, 'view')
      or private.attachment_file_purgeable(name)
    )
  );

drop policy if exists attachments_delete on storage.objects;
create policy attachments_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'attachments'
    and (
      private.attachment_object_allowed(name, 'delete')
      or private.attachment_file_purgeable(name)
    )
  );

create or replace function public.claim_attachment_file_purges(p_limit integer default 100)
returns table (path text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  is_service boolean := coalesce(auth.jwt() ->> 'role', '') = 'service_role';
  caller uuid := auth.uid();
  sees_all boolean;
begin
  if not is_service and caller is null then
    return;
  end if;
  sees_all := is_service or private.is_owner();

  return query
  update private.attachment_file_purges q
  set attempts = q.attempts + 1,
      last_tried_at = now()
  where q.storage_path in (
    select c.storage_path
    from private.attachment_file_purges c
    where (sees_all or c.queued_by = caller)
      and not exists (
        select 1
        from public.record_attachments a
        where a.storage_path = c.storage_path
      )
    order by c.attempts, c.queued_at
    limit greatest(1, least(coalesce(p_limit, 100), 500))
    for update skip locked
  )
  returning q.storage_path;
end;
$$;

create or replace function public.settle_attachment_file_purges(p_paths text[])
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  settled integer;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' and auth.uid() is null then
    return 0;
  end if;

  delete from private.attachment_file_purges q
  where q.storage_path = any (coalesce(p_paths, array[]::text[]))
    and not exists (
      select 1
      from storage.objects o
      where o.bucket_id = 'attachments'
        and o.name = q.storage_path
    );
  get diagnostics settled = row_count;
  return settled;
end;
$$;

-- Catches anything the triggers missed: rows whose parent is gone, and files with no row.
-- Files younger than an hour are skipped so an upload in flight is never touched.
create or replace function public.sweep_orphan_attachments()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  queued integer;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' and not private.is_owner() then
    raise exception 'Only an owner can clean up attachments.' using errcode = '42501';
  end if;

  delete from public.record_attachments a
  where not private.attachment_parent_exists(a.parent_type, a.parent_id);

  insert into private.attachment_file_purges (storage_path, queued_by)
  select o.name, auth.uid()
  from storage.objects o
  where o.bucket_id = 'attachments'
    and o.created_at < now() - interval '1 hour'
    and not exists (
      select 1
      from public.record_attachments a
      where a.storage_path = o.name
    )
  on conflict (storage_path) do nothing;

  select count(*)::integer into queued from private.attachment_file_purges;
  return queued;
end;
$$;

revoke all on function public.claim_attachment_file_purges(integer) from public, anon;
revoke all on function public.settle_attachment_file_purges(text[]) from public, anon;
revoke all on function public.sweep_orphan_attachments() from public, anon;
grant execute on function public.claim_attachment_file_purges(integer) to authenticated, service_role;
grant execute on function public.settle_attachment_file_purges(text[]) to authenticated, service_role;
grant execute on function public.sweep_orphan_attachments() to authenticated, service_role;

-- One-off cleanup of attachments orphaned before these triggers existed.
-- Their files are queued with no owner, so an owner's next delete or the daily sweep removes them.
delete from public.record_attachments a
where not private.attachment_parent_exists(a.parent_type, a.parent_id);

insert into private.attachment_file_purges (storage_path, queued_by)
select o.name, null
from storage.objects o
where o.bucket_id = 'attachments'
  and not exists (
    select 1
    from public.record_attachments a
    where a.storage_path = o.name
  )
on conflict (storage_path) do nothing;
