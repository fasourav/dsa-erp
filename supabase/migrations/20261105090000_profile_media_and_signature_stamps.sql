-- Private profile photo and signature, plus per-document signature stamps.
-- public.work_orders is a security-invoker view over private.work_orders.
-- The column is added on the private table, then the view and write trigger
-- are updated so saves and stamps do not drop it.

alter table public.profiles
  add column if not exists avatar_path text,
  add column if not exists signature_path text,
  add column if not exists avatar_updated_at timestamptz,
  add column if not exists signature_updated_at timestamptz;

alter table public.quotations
  add column if not exists signature_stamps jsonb not null default '{}'::jsonb;

alter table private.work_orders
  add column if not exists signature_stamps jsonb not null default '{}'::jsonb;

alter table public.issued_documents
  add column if not exists signature_stamps jsonb not null default '{}'::jsonb;

create or replace view public.work_orders
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
  purchase_order_id,
  old_number,
  subtitle,
  checked_by,
  deleted_at,
  deleted_by,
  signature_stamps
from private.work_orders;

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
      created_at, updated_at, purchase_order_id, old_number, subtitle, checked_by, deleted_at, deleted_by,
      signature_stamps
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
      new.purchase_order_id,
      new.old_number,
      coalesce(new.subtitle, ''),
      coalesce(new.checked_by, ''),
      new.deleted_at,
      new.deleted_by,
      coalesce(new.signature_stamps, '{}'::jsonb)
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
      purchase_order_id = new.purchase_order_id,
      old_number = new.old_number,
      subtitle = coalesce(new.subtitle, ''),
      checked_by = coalesce(new.checked_by, ''),
      deleted_at = new.deleted_at,
      deleted_by = new.deleted_by,
      signature_stamps = coalesce(new.signature_stamps, '{}'::jsonb)
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

create or replace function public.set_own_profile_media(media text, next_path text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if media not in ('avatar', 'signature') then
    raise exception 'bad media' using errcode = '22023';
  end if;
  if next_path is not null and next_path not like
     (case media when 'avatar' then 'avatars/' else 'signatures/' end) || uid::text || '/%' then
    raise exception 'bad path' using errcode = '42501';
  end if;
  if media = 'avatar' then
    update public.profiles
    set avatar_path = next_path, avatar_updated_at = now()
    where id = uid;
  else
    update public.profiles
    set signature_path = next_path, signature_updated_at = now()
    where id = uid;
  end if;
end;
$$;

revoke all on function public.set_own_profile_media(text, text) from public, anon, authenticated, service_role;
grant execute on function public.set_own_profile_media(text, text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-media', 'profile-media', false, 2097152, array['image/png', 'image/webp'])
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Own avatars/ and signatures/ only. document-signatures/ is service role only.
do $$
declare
  op text;
begin
  foreach op in array array['select', 'insert', 'update', 'delete'] loop
    execute format('drop policy if exists profile_media_%s on storage.objects', op);
  end loop;
end $$;

create policy profile_media_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'profile-media'
    and (storage.foldername(name))[1] in ('avatars', 'signatures')
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy profile_media_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'profile-media'
    and (storage.foldername(name))[1] in ('avatars', 'signatures')
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy profile_media_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'profile-media'
    and (storage.foldername(name))[1] in ('avatars', 'signatures')
    and (storage.foldername(name))[2] = auth.uid()::text
  )
  with check (
    bucket_id = 'profile-media'
    and (storage.foldername(name))[1] in ('avatars', 'signatures')
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy profile_media_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'profile-media'
    and (storage.foldername(name))[1] in ('avatars', 'signatures')
    and (storage.foldername(name))[2] = auth.uid()::text
  );
