-- Work orders become the printable work order for a purchase order.
-- Nullable link: existing work orders keep working without a PO.
-- Work orders still create no accounting entries.

alter table public.work_orders
  add column if not exists purchase_order_id uuid
    references public.vendor_purchase_orders (id) on delete set null;

create index if not exists work_orders_purchase_order_id_idx
  on public.work_orders (purchase_order_id);

-- Keep vendor and project in step with the linked PO so they can't drift.
create or replace function private.sync_work_order_purchase_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  po record;
begin
  if new.purchase_order_id is null then
    return new;
  end if;
  select vendor_id, project_id into po
  from public.vendor_purchase_orders
  where id = new.purchase_order_id;
  if not found then
    raise exception 'That purchase order could not be found.' using errcode = '23503';
  end if;
  new.vendor_id := po.vendor_id;
  new.project_id := po.project_id;
  return new;
end;
$$;

revoke all on function private.sync_work_order_purchase_order() from public;

drop trigger if exists work_orders_sync_purchase_order on public.work_orders;
create trigger work_orders_sync_purchase_order
  before insert or update of purchase_order_id, vendor_id, project_id on public.work_orders
  for each row execute function private.sync_work_order_purchase_order();
