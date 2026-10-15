-- The project_budget_actual view calls private.project_budget_actual_rows().
-- Postgres still checks EXECUTE for the current role even when the view is
-- security_invoker=false. Grant execute on the security-definer function so
-- authenticated users can read the view; private is not exposed by PostgREST.
grant execute on function private.project_budget_actual_rows() to authenticated;
notify pgrst, 'reload schema';
