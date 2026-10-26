-- Request for Quotation (RFQ) stored in public.form_documents with kind = 'rfq'.
-- Vendor-facing quote request gated on purchase_orders; vendor_id required, project_id optional.
-- Additive migration file only; not applied by the app.

alter table public.form_documents
  drop constraint if exists form_documents_kind_check,
  add constraint form_documents_kind_check check (
    kind in (
      'delivery_challan',
      'payment_voucher',
      'completion',
      'salary_slip',
      'letter',
      'rfq'
    )
  );

alter table public.form_documents
  drop constraint if exists form_documents_source_check,
  add constraint form_documents_source_check check (
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
    or (
      kind = 'rfq'
      and vendor_id is not null
      and client_id is null
      and purchase_order_id is null
      and vendor_payment_id is null
      and operational_expense_id is null
      and payroll_line_id is null
      and employee_id is null
    )
  );

alter policy form_documents_select on public.form_documents
  using (
    (kind = 'delivery_challan' and (private.can('purchase_orders', 'view') or private.can('projects', 'view')))
    or (kind = 'payment_voucher' and (private.can('vendor_payments', 'view') or private.can('expenses', 'view')))
    or (kind = 'completion' and private.can('projects', 'view'))
    or (kind = 'salary_slip' and private.can('payroll', 'view'))
    or (kind = 'letter' and (private.can('projects', 'view') or private.can('clients', 'view')))
    or (kind = 'rfq' and private.can('purchase_orders', 'view'))
  );

alter policy form_documents_insert on public.form_documents
  with check (
    (kind = 'delivery_challan' and (private.can('purchase_orders', 'add') or private.can('projects', 'add')))
    or (kind = 'payment_voucher' and (private.can('vendor_payments', 'add') or private.can('expenses', 'add')))
    or (kind = 'completion' and private.can('projects', 'add'))
    or (kind = 'salary_slip' and private.can('payroll', 'add'))
    or (kind = 'letter' and (private.can('projects', 'add') or private.can('clients', 'add')))
    or (kind = 'rfq' and private.can('purchase_orders', 'add'))
  );

alter policy form_documents_update on public.form_documents
  using (
    (kind = 'delivery_challan' and (private.can('purchase_orders', 'edit') or private.can('projects', 'edit')))
    or (kind = 'payment_voucher' and (private.can('vendor_payments', 'edit') or private.can('expenses', 'edit')))
    or (kind = 'completion' and private.can('projects', 'edit'))
    or (kind = 'salary_slip' and private.can('payroll', 'edit'))
    or (kind = 'letter' and (private.can('projects', 'edit') or private.can('clients', 'edit')))
    or (kind = 'rfq' and private.can('purchase_orders', 'edit'))
  )
  with check (
    (kind = 'delivery_challan' and (private.can('purchase_orders', 'edit') or private.can('projects', 'edit')))
    or (kind = 'payment_voucher' and (private.can('vendor_payments', 'edit') or private.can('expenses', 'edit')))
    or (kind = 'completion' and private.can('projects', 'edit'))
    or (kind = 'salary_slip' and private.can('payroll', 'edit'))
    or (kind = 'letter' and (private.can('projects', 'edit') or private.can('clients', 'edit')))
    or (kind = 'rfq' and private.can('purchase_orders', 'edit'))
  );

alter policy form_documents_delete on public.form_documents
  using (
    (kind = 'delivery_challan' and (private.can('purchase_orders', 'delete') or private.can('projects', 'delete')))
    or (kind = 'payment_voucher' and (private.can('vendor_payments', 'delete') or private.can('expenses', 'delete')))
    or (kind = 'completion' and private.can('projects', 'delete'))
    or (kind = 'salary_slip' and private.can('payroll', 'delete'))
    or (kind = 'letter' and (private.can('projects', 'delete') or private.can('clients', 'delete')))
    or (kind = 'rfq' and private.can('purchase_orders', 'delete'))
  );

-- Keep security definer and search_path. Map form_documents kind 'rfq' to purchase_orders.
create or replace function private.log_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  row_data jsonb;
  new_row jsonb;
  old_row jsonb;
  changed_old jsonb;
  changed_new jsonb;
  module_key text;
  label text;
  row_id text;
  verb text;
begin
  begin
    if tg_op = 'DELETE' then
      verb := 'delete';
      row_data := to_jsonb(old);
    elsif tg_op = 'UPDATE' then
      verb := 'update';
      row_data := to_jsonb(new);
    else
      verb := 'insert';
      row_data := to_jsonb(new);
    end if;

    module_key := case tg_table_name
      when 'leads' then 'leads'
      when 'clients' then 'clients'
      when 'projects' then 'projects'
      when 'vendors' then 'vendors'
      when 'vendor_purchase_orders' then 'purchase_orders'
      when 'vendor_invoices' then 'vendor_payments'
      when 'vendor_payments' then 'vendor_payments'
      when 'client_invoices' then 'client_invoices'
      when 'client_payments' then 'client_invoices'
      when 'bank_accounts' then 'banking'
      when 'bank_transactions' then 'banking'
      when 'bank_transfers' then 'banking'
      when 'operational_expenses' then 'expenses'
      when 'vat_tax_payments' then 'vat_tax'
      when 'budgets' then 'budgets'
      when 'assets' then 'assets'
      when 'asset_categories' then 'assets'
      when 'employees' then 'employees'
      when 'payroll_runs' then 'payroll'
      when 'payroll_lines' then 'payroll'
      when 'profiles' then 'users'
      when 'permission_modules' then 'users'
      when 'role_templates' then 'users'
      when 'role_template_permissions' then 'users'
      when 'user_permissions' then 'users'
      when 'user_invites' then 'users'
      when 'quotations' then 'quotations'
      when 'quotation_lines' then 'quotations'
      when 'quotation_milestones' then 'quotations'
      when 'work_orders' then 'work_orders'
      when 'work_order_lines' then 'work_orders'
      when 'work_order_milestones' then 'work_orders'
      when 'issued_documents' then
        case
          when coalesce(row_data->>'kind', '') = 'purchase_order' then 'purchase_orders'
          else 'client_invoices'
        end
      when 'form_documents' then
        case row_data->>'kind'
          when 'delivery_challan' then
            case when coalesce(row_data->>'purchase_order_id', '') <> '' then 'purchase_orders' else 'projects' end
          when 'payment_voucher' then
            case when coalesce(row_data->>'operational_expense_id', '') <> '' then 'expenses' else 'vendor_payments' end
          when 'completion' then 'projects'
          when 'salary_slip' then 'payroll'
          when 'letter' then
            case when coalesce(row_data->>'project_id', '') <> '' then 'projects' else 'clients' end
          when 'rfq' then 'purchase_orders'
          else 'projects'
        end
      else 'settings'
    end;

    if tg_table_name = 'user_permissions' then
      row_id := (row_data->>'user_id') || ':' || (row_data->>'module');
    elsif tg_table_name = 'role_template_permissions' then
      row_id := (row_data->>'template_id') || ':' || (row_data->>'module');
    else
      row_id := coalesce(row_data->>'id', row_data->>'key', row_data->>'email');
    end if;

    label := private.audit_label(tg_table_name, row_data);

    if tg_op = 'INSERT' then
      new_row := to_jsonb(new) - 'updated_at' - 'last_sign_in_at';
      changed_old := null;
      changed_new := new_row;
    elsif tg_op = 'DELETE' then
      old_row := to_jsonb(old) - 'updated_at' - 'last_sign_in_at';
      changed_old := old_row;
      changed_new := null;
    else
      new_row := to_jsonb(new) - 'updated_at' - 'last_sign_in_at';
      old_row := to_jsonb(old) - 'updated_at' - 'last_sign_in_at';
      if new_row is not distinct from old_row then
        return new;
      end if;

      select
        coalesce(jsonb_object_agg(entry.key, old_row -> entry.key), '{}'::jsonb),
        coalesce(jsonb_object_agg(entry.key, new_row -> entry.key), '{}'::jsonb)
      into changed_old, changed_new
      from jsonb_each(old_row || new_row) as entry(key, value)
      where (old_row -> entry.key) is distinct from (new_row -> entry.key);
    end if;

    insert into public.activity_log (
      actor_id,
      action,
      module,
      table_name,
      record_id,
      record_label,
      summary,
      old_values,
      new_values
    )
    values (
      auth.uid(),
      verb,
      module_key,
      tg_table_name,
      row_id,
      label,
      case verb
        when 'insert' then 'Added'
        when 'update' then 'Updated'
        else 'Deleted'
      end || ' ' || label,
      changed_old,
      changed_new
    );
  exception
    when others then
      null;
  end;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

notify pgrst, 'reload schema';
