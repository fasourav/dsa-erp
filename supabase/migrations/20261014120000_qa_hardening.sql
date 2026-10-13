-- QA hardening (PR #54 audit): pin search_path, trim anon privileges, cover FKs, initplan-friendly policies
alter function private.dashboard_delta(numeric, numeric) set search_path = '';
alter function private.dashboard_ratio(numeric, numeric) set search_path = '';
alter function private.report_admin_bucket(text) set search_path = '';
alter function private.report_aging_bucket(integer) set search_path = '';
alter function private.report_is_material(text) set search_path = '';
alter function private.report_money(numeric) set search_path = '';

revoke execute on function public.client_invoices_fill_client() from anon, public;
revoke execute on function public.guard_bank_account() from anon, public;
revoke execute on function public.resolve_bank_account_id(uuid) from anon, public;
revoke execute on function public.upsert_payroll_line_bank_tx(uuid) from anon, public;

revoke truncate, references, trigger on all tables in schema public from anon;
alter default privileges in schema public revoke truncate, references, trigger on tables from anon;

create index if not exists activity_log_actor_id_idx on public.activity_log (actor_id);
create index if not exists assets_category_id_idx on public.assets (category_id);
create index if not exists bank_transfers_from_account_id_idx on public.bank_transfers (from_account_id);
create index if not exists bank_transfers_to_account_id_idx on public.bank_transfers (to_account_id);
create index if not exists role_template_permissions_module_idx on public.role_template_permissions (module);
create index if not exists user_permissions_module_idx on public.user_permissions (module);

alter policy profiles_select on public.profiles using ((id = (select auth.uid())) or private.is_owner());
alter policy user_permissions_select on public.user_permissions using ((user_id = (select auth.uid())) or private.is_owner());
