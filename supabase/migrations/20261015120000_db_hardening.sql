-- DB review follow-ups (2026-10-15). Constraints are NOT VALID so existing rows are not rechecked;
-- live has no violating rows (checked read-only), so they are validated where safe.

-- (2) bank_transaction_details: verified it already filters rows on private.can('banking','view')
-- and masks amount via private.sees_financials(). Kept as a definer view on purpose: switching to
-- security_invoker would bypass the masking design (callers would need raw bank_transactions access).

-- (3) bank_transactions.transfer_id -> bank_transfers. Live has 0 orphans.
alter table public.bank_transactions
  drop constraint if exists bank_transactions_transfer_id_fkey;
alter table public.bank_transactions
  add constraint bank_transactions_transfer_id_fkey
  foreign key (transfer_id) references public.bank_transfers (id) on delete cascade not valid;
alter table public.bank_transactions validate constraint bank_transactions_transfer_id_fkey;
create index if not exists bank_transactions_transfer_id_idx
  on public.bank_transactions (transfer_id) where transfer_id is not null;

-- (4) Non-negative money on line items and assets; sane reconciliation figures.
alter table public.quotation_lines drop constraint if exists quotation_lines_unit_price_nonneg;
alter table public.quotation_lines
  add constraint quotation_lines_unit_price_nonneg check (unit_price is null or unit_price >= 0) not valid;
alter table public.work_order_lines drop constraint if exists work_order_lines_unit_price_nonneg;
alter table public.work_order_lines
  add constraint work_order_lines_unit_price_nonneg check (unit_price is null or unit_price >= 0) not valid;
alter table public.assets drop constraint if exists assets_total_cost_nonneg;
alter table public.assets
  add constraint assets_total_cost_nonneg check (total_cost is null or total_cost >= 0) not valid;
alter table public.bank_reconciliations drop constraint if exists bank_reconciliations_sane;
alter table public.bank_reconciliations
  add constraint bank_reconciliations_sane check (
    statement_balance between -999999999.99 and 999999999.99
    and book_balance between -999999999.99 and 999999999.99
    and difference = statement_balance - book_balance
  ) not valid;

-- (5) Primary key for verify hits. verify_business_document already purges rows older
-- than 1 day on every call (stricter than 90 days); keep a 90-day backstop in the sweep below.
alter table private.document_verify_hits
  add column if not exists id bigint generated always as identity;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'private.document_verify_hits'::regclass and contype = 'p'
  ) then
    alter table private.document_verify_hits
      add constraint document_verify_hits_pkey primary key (id);
  end if;
end $$;

create or replace function public.purge_document_verify_hits()
returns integer
language sql
security definer
set search_path = ''
as $$
  with gone as (
    delete from private.document_verify_hits
    where created_at < now() - interval '90 days'
    returning 1
  )
  select count(*)::integer from gone;
$$;
revoke all on function public.purge_document_verify_hits() from public, anon, authenticated;
grant execute on function public.purge_document_verify_hits() to service_role;

-- (7) The orphan sweep is only called by the cron route with the service role.
-- claim/settle_attachment_file_purges stay callable by authenticated: delete actions call them
-- with the signed-in session, and they only touch rows queued by that user.
revoke execute on function public.sweep_orphan_attachments() from public, anon, authenticated;
grant execute on function public.sweep_orphan_attachments() to service_role;

-- (6) Server-side Activity paging: keyset-friendly index (newest first, id tiebreak).
create index if not exists activity_log_created_at_id_desc_idx
  on public.activity_log (created_at desc, id desc);
