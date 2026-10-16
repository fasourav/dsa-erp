-- Saved documents: owner-only trash, and dated document numbers.
-- Not applied to live by this change.
--
-- Soft delete is deleted_at / deleted_by. Normal reads hide those rows from
-- anyone who is not an owner. Only an owner can set or clear them, and only an
-- owner can hard-delete a row that is already in Trash.
-- Existing numbers are rewritten in place. The previous value is kept in
-- old_number. Printed work-order and invoice references stored on the document
-- are updated to the new number so bills and receipts still point at it.

create or replace function private.document_name_code(p_name text)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(left((
      select upper(string_agg(left(word, 1), '' order by ord))
      from (
        select regexp_replace(token, '[^A-Za-z0-9]', '', 'g') as word, ord
        from regexp_split_to_table(coalesce(p_name, ''), E'\\s+') with ordinality as parts(token, ord)
      ) cleaned
      where word <> ''
    ), 16), ''),
    'NA'
  );
$$;

create or replace function private.document_date_code(p_on date)
returns text
language sql
immutable
as $$
  select to_char(coalesce(p_on, current_date), 'DDMMYY');
$$;

revoke all on function private.document_name_code(text) from public, anon, authenticated;
revoke all on function private.document_date_code(date) from public, anon, authenticated;

alter table public.quotations
  add column if not exists old_number text,
  add column if not exists subtitle text not null default '',
  add column if not exists checked_by text not null default '',
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles (id) on delete set null;

alter table public.issued_documents
  add column if not exists old_number text,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles (id) on delete set null;

alter table private.work_orders
  add column if not exists old_number text,
  add column if not exists subtitle text not null default '',
  add column if not exists checked_by text not null default '',
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles (id) on delete set null;

comment on column public.quotations.old_number is
  'Document number before the dated code format. Null for numbers that were born in the new format.';
comment on column public.issued_documents.old_number is
  'Document number before the dated code format. Null for numbers that were born in the new format.';
comment on column private.work_orders.old_number is
  'Document number before the dated code format. Null for numbers that were born in the new format.';

-- The public work order name is a security-invoker view. New columns have to be
-- appended and the write trigger has to copy them, or saves and trash updates
-- would drop the values.
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
  deleted_by
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
      created_at, updated_at, purchase_order_id, old_number, subtitle, checked_by, deleted_at, deleted_by
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
      new.deleted_by
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
      deleted_by = new.deleted_by
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

-- Renumber legacy documents. Safe to run again: a number already in the new
-- shape is left alone, and old_number is never overwritten.
do $$
declare
  pattern text := '^(Q|WO|INV|INC)/[0-9]{6}-[A-Z0-9]+-[A-Z0-9]+(-V[0-9]+)?(-[0-9]+)?$';
  rec record;
  candidate text;
  suffix integer;
begin
  create temp table doc_renumber (
    src text not null,
    id uuid not null,
    old_no text not null,
    new_no text not null,
    sort_at timestamptz not null,
    primary key (src, id)
  ) on commit drop;

  insert into doc_renumber (src, id, old_no, new_no, sort_at)
  select
    'quotations',
    q.id,
    q.document_no,
    'Q/' || private.document_date_code(q.issued_on)
      || '-' || private.document_name_code(coalesce(nullif(btrim(c.company_name), ''), nullif(btrim(c.person_name), '')))
      || '-' || private.document_name_code(p.name)
      || '-V' || (
        coalesce((
          select max((regexp_match(q2.document_no, '-V([0-9]+)'))[1]::integer)
          from public.quotations q2
          where q2.client_id = q.client_id
            and q2.project_id is not distinct from q.project_id
            and q2.document_no ~ '^Q/[0-9]{6}-[A-Z0-9]+-[A-Z0-9]+-V[0-9]+'
        ), 0)
        + row_number() over (
          partition by q.client_id, q.project_id
          order by q.issued_on, q.created_at, q.id
        )
      )::text,
    q.created_at
  from public.quotations q
  join public.clients c on c.id = q.client_id
  left join public.projects p on p.id = q.project_id
  where q.document_no !~ pattern;

  insert into doc_renumber (src, id, old_no, new_no, sort_at)
  select
    'work_orders',
    w.id,
    w.document_no,
    'WO/' || private.document_date_code(w.issued_on)
      || '-' || private.document_name_code(coalesce(nullif(btrim(v.company_name), ''), nullif(btrim(v.person_name), '')))
      || '-' || private.document_name_code(p.name),
    w.created_at
  from private.work_orders w
  join public.vendors v on v.id = w.vendor_id
  left join public.projects p on p.id = w.project_id
  where w.document_no !~ pattern;

  insert into doc_renumber (src, id, old_no, new_no, sort_at)
  select
    'issued_documents',
    d.id,
    d.document_no,
    case d.kind
      when 'invoice' then
        'INV/' || private.document_date_code(d.issued_on)
          || '-' || private.document_name_code(coalesce(nullif(btrim(c.company_name), ''), nullif(btrim(c.person_name), '')))
          || '-' || private.document_name_code(p.name)
      when 'receipt' then
        'INC/' || private.document_date_code(d.issued_on)
          || '-' || private.document_name_code(coalesce(nullif(btrim(c.company_name), ''), nullif(btrim(c.person_name), '')))
          || '-' || private.document_name_code(p.name)
      else
        'WO/' || private.document_date_code(d.issued_on)
          || '-' || private.document_name_code(coalesce(nullif(btrim(v.company_name), ''), nullif(btrim(v.person_name), '')))
          || '-' || private.document_name_code(p.name)
    end,
    d.created_at
  from public.issued_documents d
  left join public.client_invoices inv on inv.id = d.client_invoice_id
  left join public.client_payments pay on pay.id = d.client_payment_id
  left join public.client_invoices pay_inv on pay_inv.id = pay.client_invoice_id
  left join public.clients c on c.id = coalesce(inv.client_id, pay_inv.client_id)
  left join public.projects p on p.id = coalesce(inv.project_id, pay_inv.project_id)
  left join public.vendor_purchase_orders po on po.id = d.purchase_order_id
  left join public.vendors v on v.id = po.vendor_id
  left join public.projects po_project on po_project.id = po.project_id
  where d.document_no !~ pattern;

  -- Purchase-order prints take the project from the order, not the invoice join.
  update doc_renumber r
  set new_no =
    'WO/' || private.document_date_code(d.issued_on)
      || '-' || private.document_name_code(coalesce(nullif(btrim(v.company_name), ''), nullif(btrim(v.person_name), '')))
      || '-' || private.document_name_code(p.name)
  from public.issued_documents d
  join private.vendor_purchase_orders po on po.id = d.purchase_order_id
  join public.vendors v on v.id = po.vendor_id
  left join public.projects p on p.id = po.project_id
  where r.src = 'issued_documents'
    and r.id = d.id
    and d.kind = 'purchase_order';

  create temp table doc_kept (document_no text primary key) on commit drop;
  insert into doc_kept (document_no)
  select document_no from public.quotations where document_no ~ pattern
  union
  select document_no from private.work_orders where document_no ~ pattern
  union
  select document_no from public.issued_documents where document_no ~ pattern;

  for rec in
    select src, id, new_no
    from doc_renumber
    order by sort_at, src, id
  loop
    candidate := rec.new_no;
    suffix := 2;
    while exists (select 1 from doc_kept where document_no = candidate) loop
      candidate := rec.new_no || '-' || suffix::text;
      suffix := suffix + 1;
      if suffix > 40 then
        raise exception 'Could not assign a document number for %', rec.id;
      end if;
    end loop;
    update doc_renumber set new_no = candidate where src = rec.src and id = rec.id;
    insert into doc_kept (document_no) values (candidate);
  end loop;

  update public.quotations q
  set
    old_number = coalesce(q.old_number, q.document_no),
    document_no = r.new_no
  from doc_renumber r
  where r.src = 'quotations'
    and r.id = q.id
    and q.document_no is distinct from r.new_no;

  update private.work_orders w
  set
    old_number = coalesce(w.old_number, w.document_no),
    document_no = r.new_no
  from doc_renumber r
  where r.src = 'work_orders'
    and r.id = w.id
    and w.document_no is distinct from r.new_no;

  update public.issued_documents d
  set
    old_number = coalesce(d.old_number, d.document_no),
    document_no = r.new_no
  from doc_renumber r
  where r.src = 'issued_documents'
    and r.id = d.id
    and d.document_no is distinct from r.new_no;

  update public.issued_documents d
  set body = jsonb_set(d.body, '{workOrderNo}', to_jsonb(w.document_no), false)
  from private.work_orders w
  where w.old_number is not null
    and d.body->>'workOrderNo' = w.old_number
    and d.body->>'workOrderNo' is distinct from w.document_no;

  update public.issued_documents d
  set body = jsonb_set(d.body, '{againstInvoiceNo}', to_jsonb(inv.document_no), false)
  from public.issued_documents inv
  where inv.kind = 'invoice'
    and inv.old_number is not null
    and d.body->>'againstInvoiceNo' = inv.old_number
    and d.body->>'againstInvoiceNo' is distinct from inv.document_no;
end;
$$;

-- A trashed print must not still verify, and must not block a new print of the
-- same invoice, receipt, or purchase order. The document number itself stays
-- unique, including rows in Trash, so a number is never reused.
drop index if exists public.issued_documents_invoice_key;
create unique index issued_documents_invoice_key
  on public.issued_documents (client_invoice_id)
  where client_invoice_id is not null and deleted_at is null;

drop index if exists public.issued_documents_receipt_key;
create unique index issued_documents_receipt_key
  on public.issued_documents (client_payment_id)
  where client_payment_id is not null and deleted_at is null;

drop index if exists public.issued_documents_po_key;
create unique index issued_documents_po_key
  on public.issued_documents (purchase_order_id)
  where purchase_order_id is not null and deleted_at is null;

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
  ) found
  limit 1;
end;
$$;

-- One number across quotations, work orders, and issued prints. The app treats
-- 23505 on document_no as a collision and appends -2, -3, …
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
  ) then
    raise exception 'duplicate key value violates unique constraint "document_no"'
      using errcode = '23505';
  end if;
  return new;
end;
$$;

revoke all on function private.reject_duplicate_document_no() from public, anon;
grant execute on function private.reject_duplicate_document_no() to authenticated;

drop trigger if exists quotations_document_no_guard on public.quotations;
create trigger quotations_document_no_guard
  before insert or update of document_no on public.quotations
  for each row execute function private.reject_duplicate_document_no();

drop trigger if exists work_orders_document_no_guard on private.work_orders;
create trigger work_orders_document_no_guard
  before insert or update of document_no on private.work_orders
  for each row execute function private.reject_duplicate_document_no();

drop trigger if exists issued_documents_document_no_guard on public.issued_documents;
create trigger issued_documents_document_no_guard
  before insert or update of document_no on public.issued_documents
  for each row execute function private.reject_duplicate_document_no();

-- Restrictive policies AND with the existing module policies. They do not widen them.
drop policy if exists quotations_hide_trash on public.quotations;
create policy quotations_hide_trash on public.quotations
  as restrictive for select to authenticated
  using (deleted_at is null or private.is_owner());

drop policy if exists quotations_insert_live on public.quotations;
create policy quotations_insert_live on public.quotations
  as restrictive for insert to authenticated
  with check (deleted_at is null and deleted_by is null);

drop policy if exists quotations_trash_owner on public.quotations;
create policy quotations_trash_owner on public.quotations
  as restrictive for update to authenticated
  using (deleted_at is null or private.is_owner())
  with check (private.is_owner() or (deleted_at is null and deleted_by is null));

drop policy if exists quotations_hard_delete_owner on public.quotations;
create policy quotations_hard_delete_owner on public.quotations
  as restrictive for delete to authenticated
  using (private.is_owner() and deleted_at is not null);

drop policy if exists work_orders_hide_trash on private.work_orders;
create policy work_orders_hide_trash on private.work_orders
  as restrictive for select to authenticated
  using (deleted_at is null or private.is_owner());

drop policy if exists work_orders_insert_live on private.work_orders;
create policy work_orders_insert_live on private.work_orders
  as restrictive for insert to authenticated
  with check (deleted_at is null and deleted_by is null);

drop policy if exists work_orders_trash_owner on private.work_orders;
create policy work_orders_trash_owner on private.work_orders
  as restrictive for update to authenticated
  using (deleted_at is null or private.is_owner())
  with check (private.is_owner() or (deleted_at is null and deleted_by is null));

drop policy if exists work_orders_hard_delete_owner on private.work_orders;
create policy work_orders_hard_delete_owner on private.work_orders
  as restrictive for delete to authenticated
  using (private.is_owner() and deleted_at is not null);

drop policy if exists issued_documents_hide_trash on public.issued_documents;
create policy issued_documents_hide_trash on public.issued_documents
  as restrictive for select to authenticated
  using (deleted_at is null or private.is_owner());

drop policy if exists issued_documents_insert_live on public.issued_documents;
create policy issued_documents_insert_live on public.issued_documents
  as restrictive for insert to authenticated
  with check (deleted_at is null and deleted_by is null);

drop policy if exists issued_documents_trash_owner on public.issued_documents;
create policy issued_documents_trash_owner on public.issued_documents
  as restrictive for update to authenticated
  using (deleted_at is null or private.is_owner())
  with check (private.is_owner() or (deleted_at is null and deleted_by is null));

drop policy if exists issued_documents_hard_delete_owner on public.issued_documents;
create policy issued_documents_hard_delete_owner on public.issued_documents
  as restrictive for delete to authenticated
  using (private.is_owner() and deleted_at is not null);

notify pgrst, 'reload schema';
