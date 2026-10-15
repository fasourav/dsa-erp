-- A work order linked to a purchase order can switch PO but not be unlinked by an edit.
-- The link is still cleared when the PO itself is deleted (ON DELETE SET NULL).
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
    if tg_op = 'UPDATE' and old.purchase_order_id is not null
       and exists (select 1 from public.vendor_purchase_orders where id = old.purchase_order_id) then
      raise exception 'This work order belongs to a purchase order. Choose a purchase order; it can''t be removed.'
        using errcode = '23514';
    end if;
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
