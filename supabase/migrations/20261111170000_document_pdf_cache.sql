-- v1.3.2: cache of rendered document PDFs.
-- This file is not applied by the app. The owner applies it with the normal migration flow.
-- The app works without it (cache off).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('document-pdfs', 'document-pdfs', false, 10485760, array['application/pdf'])
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- No storage.objects policies for this bucket on purpose: only the service role
-- (server, after the permission check) reads or writes it.

create table if not exists public.document_pdf_cache (
  id uuid primary key default gen_random_uuid(),
  record_kind text not null check (record_kind in (
    'quotation', 'work_order', 'invoice', 'receipt', 'purchase_order',
    'delivery_challan', 'payment_voucher', 'completion', 'salary_slip', 'letter'
  )),
  record_id uuid not null,
  letterhead boolean not null,
  cache_key text not null unique check (cache_key ~ '^[0-9a-f]{64}$'),
  storage_path text not null unique,
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 10485760),
  created_at timestamptz not null default now()
);

create index if not exists document_pdf_cache_record_idx
  on public.document_pdf_cache (record_kind, record_id, created_at desc);
create index if not exists document_pdf_cache_created_idx
  on public.document_pdf_cache (created_at);

-- RLS on with no policies: authenticated and anon can do nothing; service_role bypasses RLS.
alter table public.document_pdf_cache enable row level security;
revoke all on table public.document_pdf_cache from public, anon, authenticated;
grant select, insert, delete on public.document_pdf_cache to service_role;

notify pgrst, 'reload schema';
