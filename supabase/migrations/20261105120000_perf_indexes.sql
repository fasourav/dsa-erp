-- Additive performance indexes for dashboard aggregations and paginated lists.
-- Note: for zero-lock builds on a live large database, the owner can run
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS outside a transaction in SQL Editor.

create index if not exists client_invoices_issued_on_idx on public.client_invoices (issued_on);
create index if not exists client_invoices_client_id_idx on public.client_invoices (client_id);
create index if not exists client_invoices_project_id_idx on public.client_invoices (project_id);
create index if not exists vendor_invoices_issued_on_idx on public.vendor_invoices (issued_on);
create index if not exists vendor_invoices_status_idx on public.vendor_invoices (status);
create index if not exists operational_expenses_expense_date_idx on public.operational_expenses (expense_date);
create index if not exists bank_transactions_account_date_idx on public.bank_transactions (bank_account_id, transaction_date desc);
create index if not exists bank_transactions_transaction_date_idx on public.bank_transactions (transaction_date desc);
create index if not exists leads_added_on_idx on public.leads (added_on);
create index if not exists leads_status_idx on public.leads (status);
create index if not exists projects_year_idx on public.projects (year);
create index if not exists projects_status_idx on public.projects (status);
