-- 20261113120000_service_role_grants.sql
-- Already applied on live as migration 20261113063536 (service_role_grants); idempotent and safe to re-run.

-- 1. Schemas (already granted on live; kept so the file is self-contained).
grant usage on schema public to service_role;
grant usage on schema private to service_role;

-- 2. Every table and view in public (GRANT ... ON ALL TABLES covers views too).
grant select, insert, update, delete on all tables in schema public to service_role;

-- 3. Sequences (live has none in public today; harmless, future-proof).
grant usage, select on all sequences in schema public to service_role;

-- 4. The private tables behind the security_invoker money views.
--    Deliberately NOT private.attachment_file_purges or private.document_verify_hits:
--    those are locked on purpose and reached only through SECURITY DEFINER functions.
grant select, insert, update, delete on table
  private.vendor_purchase_orders,
  private.work_orders,
  private.project_budget_lines,
  private.project_milestones
to service_role;

-- 5. private.session_sees_money() calls private.sees_money(); Postgres checks EXECUTE on it
--    even for service_role (live probe: "permission denied for function sees_money").
grant execute on function private.sees_money() to service_role;

-- 6. Future tables/sequences created by postgres in public get the same service_role access,
--    so a new table can never silently break the backup again. anon/authenticated still need
--    explicit grants per table (current project posture is unchanged for them).
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges for role postgres in schema public
  grant usage, select on sequences to service_role;

notify pgrst, 'reload schema';

-- Verify after applying (read-only):
-- select count(*) filter (where not has_table_privilege('service_role', c.oid, 'SELECT')) as still_blocked
-- from pg_class c join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public' and c.relkind in ('r','v','m','p');            -- expect 0
-- select has_function_privilege('service_role', 'private.sees_money()', 'EXECUTE');  -- expect true
