-- External Request for Quotation (RFQ).
-- The RFQ form no longer reads vendors or projects and no longer stores its body.
-- A saved RFQ keeps only its document number and the generated PDF file.
--
-- 1. public.rfq_documents holds the document number and the storage path of the PDF.
--    Updating an RFQ replaces the file and the document number on the same row.
--    Rows can be deleted. Access follows the purchase_orders permission, like the old RFQ.
-- 2. Files live in the private 'rfq-files' bucket at '<rfq id>/<file id>.pdf'.
-- 3. A file expires 30 days after it was created. The daily /api/cron/attachments job
--    removes expired files through the Storage API (SQL cannot delete storage objects)
--    and then clears storage_path. The row and its document number stay until deleted.
--
-- Existing public.form_documents rows with kind = 'rfq' are left as they are.
-- This file is not applied by the app. Apply it with the normal migration flow.

create table if not exists public.rfq_documents (
  id uuid primary key default gen_random_uuid(),
  document_no text not null,
  storage_path text,
  file_created_at timestamptz not null default now(),
  file_expires_at timestamptz not null default (now() + interval '30 days'),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rfq_documents_document_no_key unique (document_no),
  constraint rfq_documents_document_no_check check (char_length(btrim(document_no)) between 1 and 160),
  constraint rfq_documents_storage_path_check check (
    storage_path is null
    or storage_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$'
  ),
  constraint rfq_documents_expiry_check check (file_expires_at > file_created_at)
);

create index if not exists rfq_documents_file_expires_idx
  on public.rfq_documents (file_expires_at)
  where storage_path is not null;

create index if not exists rfq_documents_created_idx
  on public.rfq_documents (created_at desc);

alter table public.rfq_documents enable row level security;

drop policy if exists rfq_documents_select on public.rfq_documents;
create policy rfq_documents_select on public.rfq_documents
  for select to authenticated
  using (private.can('purchase_orders', 'view'));

drop policy if exists rfq_documents_insert on public.rfq_documents;
create policy rfq_documents_insert on public.rfq_documents
  for insert to authenticated
  with check (private.can('purchase_orders', 'add'));

drop policy if exists rfq_documents_update on public.rfq_documents;
create policy rfq_documents_update on public.rfq_documents
  for update to authenticated
  using (private.can('purchase_orders', 'edit'))
  with check (private.can('purchase_orders', 'edit'));

drop policy if exists rfq_documents_delete on public.rfq_documents;
create policy rfq_documents_delete on public.rfq_documents
  for delete to authenticated
  using (private.can('purchase_orders', 'delete'));

revoke all on table public.rfq_documents from anon, public;
grant select, insert, update, delete on public.rfq_documents to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('rfq-files', 'rfq-files', false, 10485760, array['application/pdf'])
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists rfq_files_select on storage.objects;
create policy rfq_files_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'rfq-files'
    and private.can('purchase_orders', 'view')
  );

drop policy if exists rfq_files_insert on storage.objects;
create policy rfq_files_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'rfq-files'
    and (private.can('purchase_orders', 'add') or private.can('purchase_orders', 'edit'))
  );

drop policy if exists rfq_files_delete on storage.objects;
create policy rfq_files_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'rfq-files'
    and (private.can('purchase_orders', 'edit') or private.can('purchase_orders', 'delete'))
  );

notify pgrst, 'reload schema';
