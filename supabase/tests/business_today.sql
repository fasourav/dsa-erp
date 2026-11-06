-- private.business_today() is the Asia/Dhaka calendar date, independent of the
-- session TimeZone, and no deployed function/view still uses CURRENT_DATE.
-- TEST DB only. psql -v ON_ERROR_STOP=1 -f supabase/tests/business_today.sql
\set ON_ERROR_STOP on
begin;

set local timezone = 'UTC';
do $$
begin
  if private.business_today() <> (now() at time zone 'Asia/Dhaka')::date then
    raise exception 'business_today under UTC session is wrong';
  end if;
end $$;

set local timezone = 'America/New_York';
do $$
begin
  if private.business_today() <> (now() at time zone 'Asia/Dhaka')::date then
    raise exception 'business_today under New York session is wrong';
  end if;
  if private.document_date_code(null) <> to_char(private.business_today(), 'DDMMYY') then
    raise exception 'document_date_code(null) must use the Dhaka day';
  end if;
  if private.document_date_code('2028-02-29'::date) <> '290228' then
    raise exception 'document_date_code must keep a stored date exactly as entered';
  end if;
end $$;

do $$
declare v_default text;
begin
  select pg_get_expr(d.adbin, d.adrelid) into v_default
  from pg_attrdef d
  join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
  where d.adrelid = 'public.leads'::regclass and a.attname = 'added_on';
  if v_default <> 'private.business_today()' then
    raise exception 'leads.added_on default is %', v_default;
  end if;
end $$;

do $$
declare v_left int;
begin
  select count(*) into v_left
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private') and p.prosrc ilike '%current_date%';
  if v_left > 0 then raise exception '% functions still use current_date', v_left; end if;

  select count(*) into v_left
  from pg_views
  where schemaname in ('public', 'private') and definition ilike '%current_date%';
  if v_left > 0 then raise exception '% views still use current_date', v_left; end if;
end $$;

rollback;
