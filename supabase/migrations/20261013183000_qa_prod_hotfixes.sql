-- Reproduce the three hotfixes already applied on production after
-- 20261013160000_qa_long_term_fixes. Idempotent: production already matches
-- this end state.
--
-- Verified against pg_get_functiondef on 2026-10-13. The eleven bank-sync
-- trigger function bodies already match the earlier migrations. The live
-- change is SECURITY DEFINER, a fixed search_path, and EXECUTE revoked from
-- anon, authenticated, and public. service_role keeps EXECUTE so the
-- service key can still run them. Triggers keep firing because PostgreSQL
-- does not re-check EXECUTE when a trigger runs.
--
-- private.sees_financials() stays executable by authenticated. The readable
-- views call it as the signed-in user. Do not revoke that grant.

grant execute on function private.sees_financials() to authenticated;

do $$
declare
  fn text;
  names text[] := array[
    'assign_bank_account()',
    'assign_payroll_bank_account()',
    'delete_transfer_from_leg()',
    'delete_transfer_legs()',
    'sync_client_payment_bank_tx()',
    'sync_operational_expense_bank_tx()',
    'sync_payroll_line_bank_tx()',
    'sync_payroll_run_bank_tx()',
    'sync_transfer_legs()',
    'sync_vat_tax_payment_bank_tx()',
    'sync_vendor_payment_bank_tx()'
  ];
begin
  foreach fn in array names
  loop
    execute format('alter function public.%s security definer', fn);
    execute format('alter function public.%s set search_path = public', fn);
    execute format(
      'revoke all on function public.%s from public, anon, authenticated',
      fn
    );
  end loop;
end $$;
