-- Security-invoker RPCs (search_records, vendor_statement, client_statement)
-- call helpers in schema private. They fail for every API role with
-- SQLSTATE 42501 "permission denied for schema private" when USAGE is missing.
-- These grants already exist in 20261012140000_users_permissions.sql and
-- 20261013211000_audit_activity.sql. Re-assert them. PostgREST does not
-- expose schema private, so this does not add new REST tables.

grant usage on schema private to authenticated;
grant usage on schema private to service_role;
