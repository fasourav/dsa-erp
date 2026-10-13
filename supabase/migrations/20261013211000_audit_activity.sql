-- Generic audit trail for business tables.
-- Records the actor, action, module, a human label, and jsonb diffs of changed fields.
-- Skips noisy columns (updated_at, last_sign_in_at) and ignores updates that only touch those.
-- The trigger is security definer with a fixed search_path and swallows its own errors
-- so a logging failure cannot roll back the original write.
-- private is not an exposed API schema, so these functions are not RPCs.
-- anon and public cannot execute them. authenticated and service_role keep EXECUTE
-- because PostgreSQL checks that privilege before entering the function; revoking it
-- would abort the write before the exception handler can run.

alter table public.activity_log
  add column if not exists record_label text,
  add column if not exists old_values jsonb,
  add column if not exists new_values jsonb;

create index if not exists activity_log_module_actor_created_idx
  on public.activity_log (module, actor_id, created_at desc);

create or replace function private.audit_label(target_table text, row_data jsonb)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  label text;
begin
  if target_table in ('clients', 'vendors') then
    label := coalesce(
      nullif(btrim(row_data->>'person_name'), ''),
      nullif(btrim(row_data->>'company_name'), '')
    );
  elsif target_table = 'leads' then
    label := nullif(btrim(row_data->>'lead_name'), '');
  elsif target_table in (
    'projects', 'employees', 'assets', 'asset_categories', 'bank_accounts',
    'departments', 'lead_sources', 'lead_stages', 'lead_statuses', 'lead_types',
    'office_expense_categories', 'payment_methods', 'project_expense_categories',
    'project_phases', 'project_types', 'vendor_work_categories'
  ) then
    label := coalesce(
      nullif(btrim(row_data->>'name'), ''),
      nullif(btrim(row_data->>'full_name'), '')
    );
  elsif target_table = 'client_invoices' then
    label := coalesce(
      nullif(btrim(row_data->>'description'), ''),
      'Invoice ' || nullif(row_data->>'issued_on', '')
    );
  elsif target_table = 'vendor_invoices' then
    label := coalesce(
      nullif(btrim(row_data->>'description'), ''),
      'Vendor Invoice ' || nullif(row_data->>'issued_on', '')
    );
  elsif target_table in ('client_payments', 'vendor_payments') then
    label := coalesce(
      nullif(btrim(row_data->>'reference'), ''),
      nullif(btrim(row_data->>'notes'), ''),
      'Payment ' || nullif(row_data->>'paid_on', '')
    );
  elsif target_table = 'vendor_purchase_orders' then
    label := coalesce(
      nullif(btrim(row_data->>'work_type'), ''),
      'Purchase Order ' || nullif(row_data->>'issued_on', '')
    );
  elsif target_table = 'vat_tax_payments' then
    label := coalesce(
      nullif(btrim(row_data->>'notes'), ''),
      'VAT Payment ' || nullif(row_data->>'paid_on', '')
    );
  elsif target_table = 'bank_transactions' then
    label := coalesce(
      nullif(btrim(row_data->>'notes'), ''),
      'Bank Transaction ' || nullif(row_data->>'transaction_date', '')
    );
  elsif target_table = 'bank_transfers' then
    label := coalesce(
      nullif(btrim(row_data->>'notes'), ''),
      'Transfer ' || nullif(row_data->>'transfer_date', '')
    );
  elsif target_table = 'operational_expenses' then
    label := coalesce(
      nullif(btrim(row_data->>'notes'), ''),
      nullif(btrim(row_data->>'category'), ''),
      'Expense ' || nullif(row_data->>'expense_date', '')
    );
  elsif target_table = 'budgets' then
    select d.name || ' ' || (row_data->>'period_year') || '-' || lpad(row_data->>'period_month', 2, '0')
    into label
    from public.departments d
    where d.id = nullif(row_data->>'department_id', '')::uuid;
  elsif target_table = 'payroll_runs' then
    label := 'Payroll ' || coalesce(row_data->>'period_year', '') || '-' || lpad(coalesce(row_data->>'period_month', ''), 2, '0');
  elsif target_table = 'payroll_lines' then
    select e.full_name
    into label
    from public.employees e
    where e.id = nullif(row_data->>'employee_id', '')::uuid;
  elsif target_table = 'profiles' then
    label := coalesce(
      nullif(btrim(row_data->>'display_name'), ''),
      nullif(btrim(row_data->>'email'), '')
    );
  elsif target_table = 'user_invites' then
    label := coalesce(
      nullif(btrim(row_data->>'display_name'), ''),
      nullif(btrim(row_data->>'email'), '')
    );
  elsif target_table = 'permission_modules' then
    label := nullif(btrim(row_data->>'label'), '');
  elsif target_table = 'role_templates' then
    label := nullif(btrim(row_data->>'label'), '');
  elsif target_table = 'role_template_permissions' then
    select rt.label || ' ' || (row_data->>'module')
    into label
    from public.role_templates rt
    where rt.id = nullif(row_data->>'template_id', '')::uuid;
  elsif target_table = 'user_permissions' then
    select coalesce(nullif(btrim(p.display_name), ''), nullif(btrim(p.email), ''), 'User')
      || ' ' || (row_data->>'module')
    into label
    from public.profiles p
    where p.id = nullif(row_data->>'user_id', '')::uuid;
  elsif target_table = 'company_settings' then
    label := 'Company Settings';
  end if;

  return coalesce(nullif(btrim(label), ''), 'Record');
exception
  when others then
    return 'Record';
end;
$$;

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

do $$
declare
  item record;
begin
  for item in
    select tg.tgname as trigger_name, cls.relname as table_name
    from pg_trigger tg
    join pg_class cls on cls.oid = tg.tgrelid
    join pg_namespace nsp on nsp.oid = cls.relnamespace
    where nsp.nspname = 'public'
      and not tg.tgisinternal
      and tg.tgname like '%\_activity' escape '\'
  loop
    execute format('drop trigger if exists %I on public.%I', item.trigger_name, item.table_name);
  end loop;
end $$;

do $$
declare
  item text;
begin
  foreach item in array array[
    'leads',
    'clients',
    'projects',
    'vendors',
    'vendor_purchase_orders',
    'vendor_invoices',
    'vendor_payments',
    'client_invoices',
    'client_payments',
    'bank_accounts',
    'bank_transactions',
    'bank_transfers',
    'operational_expenses',
    'vat_tax_payments',
    'budgets',
    'assets',
    'asset_categories',
    'employees',
    'payroll_runs',
    'payroll_lines',
    'departments',
    'lead_sources',
    'lead_stages',
    'lead_statuses',
    'lead_types',
    'office_expense_categories',
    'payment_methods',
    'project_expense_categories',
    'project_phases',
    'project_types',
    'vendor_work_categories',
    'company_settings',
    'profiles',
    'permission_modules',
    'role_templates',
    'role_template_permissions',
    'user_permissions',
    'user_invites'
  ]
  loop
    execute format('drop trigger if exists %I on public.%I', item || '_activity', item);
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function private.log_activity()',
      item || '_activity',
      item
    );
  end loop;
end $$;

revoke all on function private.audit_label(text, jsonb) from public, anon, authenticated, service_role;

revoke all on function private.log_activity() from public, anon, authenticated, service_role;
grant execute on function private.log_activity() to authenticated, service_role;

grant usage on schema private to service_role;
