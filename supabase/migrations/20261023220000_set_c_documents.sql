-- Set C documents: delivery challans, payment vouchers, completion
-- certificates, salary slips, and letters. Quotations may name a lead
-- when there is no client yet. Existing document numbers are not changed.
-- This file is not applied by the app. Apply it with the normal migration flow.

alter table public.quotations
  add column if not exists lead_id uuid references public.leads (id) on delete restrict;

alter table public.quotations alter column client_id drop not null;

alter table public.quotations drop constraint if exists quotations_party_check;
alter table public.quotations
  add constraint quotations_party_check
  check (client_id is not null or lead_id is not null);

comment on column public.quotations.lead_id is
  'Set when the quotation is for a lead that is not yet a client.';

create table public.form_documents (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in (
    'delivery_challan', 'payment_voucher', 'completion', 'salary_slip', 'letter'
  )),
  document_no text not null unique,
  issued_on date not null,
  status text not null default 'issued'
    check (status in ('draft', 'issued', 'void')),
  total numeric(14, 2) not null default 0 check (total >= 0),
  verify_token text not null unique check (verify_token ~ '^[0-9a-f]{64}$'),
  project_id uuid references public.projects (id) on delete restrict,
  client_id uuid references public.clients (id) on delete restrict,
  vendor_id uuid references public.vendors (id) on delete restrict,
  purchase_order_id uuid references public.vendor_purchase_orders (id) on delete restrict,
  vendor_payment_id uuid references public.vendor_payments (id) on delete restrict,
  operational_expense_id uuid references public.operational_expenses (id) on delete restrict,
  payroll_line_id uuid references public.payroll_lines (id) on delete restrict,
  employee_id uuid references public.employees (id) on delete restrict,
  body jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  deleted_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint form_documents_source_check check (
    (kind = 'delivery_challan' and (purchase_order_id is not null or project_id is not null))
    or (
      kind = 'payment_voucher'
      and (
        (vendor_payment_id is not null and operational_expense_id is null)
        or (operational_expense_id is not null and vendor_payment_id is null)
      )
    )
    or (kind = 'completion' and project_id is not null)
    or (kind = 'salary_slip' and payroll_line_id is not null and employee_id is not null)
    or kind = 'letter'
  )
);

create unique index form_documents_vendor_payment_key
  on public.form_documents (vendor_payment_id)
  where kind = 'payment_voucher' and vendor_payment_id is not null and deleted_at is null;

create unique index form_documents_expense_key
  on public.form_documents (operational_expense_id)
  where kind = 'payment_voucher' and operational_expense_id is not null and deleted_at is null;

create unique index form_documents_payroll_key
  on public.form_documents (payroll_line_id)
  where kind = 'salary_slip' and payroll_line_id is not null and deleted_at is null;

create index form_documents_kind_idx on public.form_documents (kind, issued_on desc);

alter table public.form_documents enable row level security;

create policy form_documents_select on public.form_documents
  for select to authenticated
  using (
    (kind = 'delivery_challan' and (private.can('purchase_orders', 'view') or private.can('projects', 'view')))
    or (kind = 'payment_voucher' and (private.can('vendor_payments', 'view') or private.can('expenses', 'view')))
    or (kind = 'completion' and private.can('projects', 'view'))
    or (kind = 'salary_slip' and private.can('payroll', 'view'))
    or (kind = 'letter' and (private.can('projects', 'view') or private.can('clients', 'view')))
  );

create policy form_documents_insert on public.form_documents
  for insert to authenticated
  with check (
    (kind = 'delivery_challan' and (private.can('purchase_orders', 'add') or private.can('projects', 'add')))
    or (kind = 'payment_voucher' and (private.can('vendor_payments', 'add') or private.can('expenses', 'add')))
    or (kind = 'completion' and private.can('projects', 'add'))
    or (kind = 'salary_slip' and private.can('payroll', 'add'))
    or (kind = 'letter' and (private.can('projects', 'add') or private.can('clients', 'add')))
  );

create policy form_documents_update on public.form_documents
  for update to authenticated
  using (
    (kind = 'delivery_challan' and (private.can('purchase_orders', 'edit') or private.can('projects', 'edit')))
    or (kind = 'payment_voucher' and (private.can('vendor_payments', 'edit') or private.can('expenses', 'edit')))
    or (kind = 'completion' and private.can('projects', 'edit'))
    or (kind = 'salary_slip' and private.can('payroll', 'edit'))
    or (kind = 'letter' and (private.can('projects', 'edit') or private.can('clients', 'edit')))
  )
  with check (
    (kind = 'delivery_challan' and (private.can('purchase_orders', 'edit') or private.can('projects', 'edit')))
    or (kind = 'payment_voucher' and (private.can('vendor_payments', 'edit') or private.can('expenses', 'edit')))
    or (kind = 'completion' and private.can('projects', 'edit'))
    or (kind = 'salary_slip' and private.can('payroll', 'edit'))
    or (kind = 'letter' and (private.can('projects', 'edit') or private.can('clients', 'edit')))
  );

create policy form_documents_delete on public.form_documents
  for delete to authenticated
  using (
    (kind = 'delivery_challan' and (private.can('purchase_orders', 'delete') or private.can('projects', 'delete')))
    or (kind = 'payment_voucher' and (private.can('vendor_payments', 'delete') or private.can('expenses', 'delete')))
    or (kind = 'completion' and private.can('projects', 'delete'))
    or (kind = 'salary_slip' and private.can('payroll', 'delete'))
    or (kind = 'letter' and (private.can('projects', 'delete') or private.can('clients', 'delete')))
  );

revoke all on table public.form_documents from anon, public;
grant select, insert, update, delete on public.form_documents to authenticated;

create or replace function private.reject_duplicate_document_no()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.quotations
    where document_no = new.document_no
      and (tg_table_name <> 'quotations' or id is distinct from new.id)
  ) or exists (
    select 1 from private.work_orders
    where document_no = new.document_no
      and (tg_table_name <> 'work_orders' or id is distinct from new.id)
  ) or exists (
    select 1 from public.issued_documents
    where document_no = new.document_no
      and (tg_table_name <> 'issued_documents' or id is distinct from new.id)
  ) or exists (
    select 1 from public.form_documents
    where document_no = new.document_no
      and (tg_table_name <> 'form_documents' or id is distinct from new.id)
  ) then
    raise exception 'duplicate key value violates unique constraint "document_no"'
      using errcode = '23505';
  end if;
  return new;
end;
$$;

drop trigger if exists form_documents_document_no_guard on public.form_documents;
create trigger form_documents_document_no_guard
  before insert or update of document_no on public.form_documents
  for each row execute function private.reject_duplicate_document_no();

create or replace function private.verify_business_document(p_token text)
returns table (
  outcome text,
  document_no text,
  issued_on date,
  total numeric,
  status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  hashed text;
  recent_token integer;
  recent_global integer;
  matched boolean;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return query
    select 'missing'::text, null::text, null::date, null::numeric, null::text;
    return;
  end if;

  hashed := md5(p_token);

  delete from private.document_verify_hits
  where created_at < now() - interval '1 day';

  select count(*)::integer
  into recent_global
  from private.document_verify_hits
  where created_at > now() - interval '1 minute';

  if recent_global >= 300 then
    return query
    select 'limited'::text, null::text, null::date, null::numeric, null::text;
    return;
  end if;

  insert into private.document_verify_hits (token_hash)
  values (hashed);

  select count(*)::integer
  into recent_token
  from private.document_verify_hits
  where token_hash = hashed
    and created_at > now() - interval '10 minutes';

  if recent_token > 30 then
    return query
    select 'limited'::text, null::text, null::date, null::numeric, null::text;
    return;
  end if;

  matched := exists (
    select 1 from public.issued_documents d
    where d.verify_token = p_token and d.deleted_at is null
    union all
    select 1 from public.quotations q
    where q.verify_token = p_token and q.deleted_at is null
    union all
    select 1 from private.work_orders w
    where w.verify_token = p_token and w.deleted_at is null
    union all
    select 1 from public.form_documents f
    where f.verify_token = p_token and f.deleted_at is null
  );

  if not matched then
    return query
    select 'missing'::text, null::text, null::date, null::numeric, null::text;
    return;
  end if;

  return query
  select
    'ok'::text,
    found.document_no,
    found.issued_on,
    found.total,
    found.status
  from (
    select
      d.document_no,
      d.issued_on,
      d.total,
      case
        when d.kind = 'receipt' then 'Received'
        when d.kind = 'invoice' and i.id is not null and i.status = 'void' then 'Void'
        when d.kind = 'invoice' and i.id is not null and coalesce(pay.paid, 0) <= 0 then 'Unpaid'
        when d.kind = 'invoice' and i.id is not null and coalesce(pay.paid, 0) + 0.009 < i.amount then 'Partial'
        when d.kind = 'invoice' and i.id is not null then 'Paid'
        else 'Issued'
      end as status
    from public.issued_documents d
    left join public.client_invoices i on i.id = d.client_invoice_id
    left join lateral (
      select sum(p.amount) as paid
      from public.client_payments p
      where p.client_invoice_id = i.id
    ) pay on true
    where d.verify_token = p_token
      and d.deleted_at is null

    union all

    select
      q.document_no,
      q.issued_on,
      q.total,
      case q.status
        when 'draft' then 'Draft'
        when 'issued' then 'Issued'
        when 'accepted' then 'Accepted'
        when 'declined' then 'Declined'
        when 'void' then 'Void'
        else 'Issued'
      end
    from public.quotations q
    where q.verify_token = p_token
      and q.deleted_at is null

    union all

    select
      w.document_no,
      w.issued_on,
      w.total,
      case w.status
        when 'draft' then 'Draft'
        when 'issued' then 'Issued'
        when 'accepted' then 'Accepted'
        when 'completed' then 'Completed'
        when 'void' then 'Void'
        else 'Issued'
      end
    from private.work_orders w
    where w.verify_token = p_token
      and w.deleted_at is null

    union all

    select
      f.document_no,
      f.issued_on,
      f.total,
      case f.status
        when 'draft' then 'Draft'
        when 'void' then 'Void'
        else 'Issued'
      end
    from public.form_documents f
    where f.verify_token = p_token
      and f.deleted_at is null
  ) found
  limit 1;
end;
$$;

notify pgrst, 'reload schema';
