-- v1.1.2: one Asia/Dhaka business date for SQL defaults and triggers.
-- Sessions run in UTC, so CURRENT_DATE was the UTC day (wrong 00:00-06:00 Dhaka).
-- Timestamps (now(), timestamptz) are unchanged; only "today" changes.

create or replace function private.business_today()
returns date
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select (now() at time zone 'Asia/Dhaka')::date;
$$;

revoke all on function private.business_today() from public, anon;
grant execute on function private.business_today() to authenticated, service_role;

alter table public.leads
  alter column added_on set default private.business_today();

-- Was IMMUTABLE while reading current_date (incorrect volatility); now STABLE.
create or replace function private.document_date_code(p_on date)
returns text
language sql
stable
as $$
  select to_char(coalesce(p_on, private.business_today()), 'DDMMYY');
$$;

revoke all on function private.document_date_code(date) from public, anon, authenticated;
