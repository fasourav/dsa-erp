-- Closing statement balances match AP and AR aging for the same party.
-- Purchase orders are not amounts owed. Requires bill-based report_ap_aging (qa16_fixes).
-- Run with `supabase test db`.

begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

do $$
declare
  v_user uuid := gen_random_uuid();
  v_bank uuid := gen_random_uuid();
  v_vendor uuid := gen_random_uuid();
  v_client uuid := gen_random_uuid();
  v_project uuid := gen_random_uuid();
  v_alpha uuid := gen_random_uuid();
  v_beta uuid := gen_random_uuid();
  v_po uuid := gen_random_uuid();
  v_po_unbilled uuid := gen_random_uuid();
  v_bill_open uuid := gen_random_uuid();
  v_bill_paid uuid := gen_random_uuid();
  v_bill_later uuid := gen_random_uuid();
  v_invoice_alpha uuid := gen_random_uuid();
  v_invoice_beta uuid := gen_random_uuid();
begin
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_user,
    'authenticated',
    'authenticated',
    'stmt-test-' || v_user::text || '@example.com',
    '',
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('role', 'owner', 'show_financials', true),
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  update public.profiles
  set role = 'owner', status = 'active', show_financials = true
  where id = v_user;

  perform set_config('request.jwt.claim.sub', v_user::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_user, 'role', 'authenticated')::text,
    true
  );

  insert into public.bank_accounts (id, name, currency, opening_balance)
  values (v_bank, 'Statement Test Bank', 'BDT', 1000000);

  insert into public.vendors (id, kind, person_name)
  values (v_vendor, 'private', 'Stmt Vendor 4ef5');

  insert into public.clients (id, kind, person_name)
  values (v_client, 'person', 'Stmt Client 4ef5');

  insert into public.projects (id, client_id, name, started_on, status, total_value, year)
  values
    (v_project, v_client, 'Stmt Vendor Project', '2024-01-01', 'active', 1000000, 2024),
    (v_alpha, v_client, 'Stmt Alpha', '2024-01-01', 'active', 50000, 2024),
    (v_beta, v_client, 'Stmt Beta', '2024-01-01', 'active', 50000, 2024);

  insert into public.vendor_purchase_orders (
    id, vendor_id, project_id, issued_on, total_value, work_type
  ) values
    (v_po, v_vendor, v_project, '2024-01-01', 2000, 'Stone Work'),
    (v_po_unbilled, v_vendor, v_project, '2024-01-01', 800000, 'Unbilled Work');

  insert into public.vendor_invoices (id, purchase_order_id, issued_on, amount, description, status)
  values
    (v_bill_open, v_po, '2024-01-15', 1000, 'January Bill', 'unpaid'),
    (v_bill_paid, v_po, '2024-03-10', 100, 'March Bill', 'unpaid'),
    (v_bill_later, v_po, '2024-06-01', 200, 'June Bill', 'unpaid'),
    (gen_random_uuid(), v_po, '2024-01-20', 5000, 'Void Bill', 'void');

  insert into public.vendor_payments (vendor_invoice_id, bank_account_id, paid_on, amount, reference)
  values
    (v_bill_open, v_bank, '2024-02-01', 300, 'January Payment'),
    (v_bill_paid, v_bank, '2024-03-15', 40, 'Early Payment');

  insert into public.client_invoices (id, client_id, project_id, issued_on, amount, description, status)
  values
    (v_invoice_alpha, v_client, v_alpha, '2024-01-10', 1000, 'Alpha Invoice', 'unpaid'),
    (v_invoice_beta, v_client, v_beta, '2024-05-01', 400, 'Beta Invoice', 'unpaid'),
    (gen_random_uuid(), v_client, v_alpha, '2024-01-12', 9000, 'Void Invoice', 'void');

  insert into public.client_payments (client_invoice_id, bank_account_id, paid_on, amount, reference)
  values
    (v_invoice_alpha, v_bank, '2024-02-02', 250, 'Alpha Payment'),
    (v_invoice_alpha, v_bank, '2025-06-01', 100, 'Later Payment');

  perform set_config('test.vendor_id', v_vendor::text, true);
  perform set_config('test.client_id', v_client::text, true);
  perform set_config('test.alpha_id', v_alpha::text, true);
  perform set_config('test.beta_id', v_beta::text, true);
end $$;

select is(
  (private.vendor_statement(
    current_setting('test.vendor_id')::uuid,
    date '2024-03-01',
    date '2024-12-31'
  ) ->> 'opening')::numeric,
  700::numeric,
  'vendor opening is bills minus payments before the period'
);

select is(
  (private.vendor_statement(
    current_setting('test.vendor_id')::uuid,
    date '2024-03-01',
    date '2024-12-31'
  ) ->> 'closing')::numeric,
  (
    select coalesce(sum((item ->> 'amount')::numeric), 0)
    from jsonb_array_elements(
      coalesce(private.report_ap_aging(date '2024-12-31') -> 'rows', '[]'::jsonb)
    ) item
    where item ->> 'party' = 'Stmt Vendor 4ef5'
  ),
  'vendor closing matches that vendor AP aging total'
);

select cmp_ok(
  (private.vendor_statement(
    current_setting('test.vendor_id')::uuid,
    date '2024-03-01',
    date '2024-12-31'
  ) ->> 'closing')::numeric,
  '<',
  10000::numeric,
  'unbilled purchase order is not an amount owed'
);

select is(
  (private.client_statement(
    current_setting('test.client_id')::uuid,
    date '2024-03-01',
    date '2024-12-31'
  ) ->> 'closing')::numeric,
  (
    select coalesce(sum((item ->> 'amount')::numeric), 0)
    from jsonb_array_elements(
      coalesce(private.report_ar_aging(date '2024-12-31') -> 'rows', '[]'::jsonb)
    ) item
    where item ->> 'party' = 'Stmt Client 4ef5'
  ),
  'client closing matches that client AR aging total'
);

select is(
  (private.client_statement(
    current_setting('test.client_id')::uuid,
    date '2024-03-01',
    date '2024-12-31',
    current_setting('test.alpha_id')::uuid
  ) ->> 'closing')::numeric,
  750::numeric,
  'client project filter keeps only that project balance'
);

select is(
  (private.client_statement(
    current_setting('test.client_id')::uuid,
    date '2024-03-01',
    date '2024-12-31',
    current_setting('test.beta_id')::uuid
  ) ->> 'closing')::numeric,
  400::numeric,
  'client project filter closing is the open balance of that project'
);

select * from finish();

rollback;
