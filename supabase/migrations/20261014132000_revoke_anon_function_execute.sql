-- Logged-out callers (anon, and PUBLIC which anon inherits) may execute only
-- public.verify_business_document. Sign-in goes through Supabase Auth and runs no
-- app function as anon; private.handle_auth_user is a trigger, and Postgres does
-- not check EXECUTE when a trigger fires.

-- pg_trgm's 31 functions sit in the API-exposed public schema. Their grants were
-- made by supabase_admin, so a REVOKE from postgres would be a no-op. Moving the
-- extension takes them off the API; the trigram indexes keep their operator class.
do $$
begin
  if exists (
    select 1
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pg_trgm' and n.nspname = 'public'
  ) then
    execute 'alter extension pg_trgm set schema extensions';
  end if;
end
$$;

-- Revoke anon and PUBLIC from every app function in public and private. Where a
-- signed-in or service caller could only execute a function through PUBLIC, grant
-- that role directly so nothing it can call today stops working. Trigger
-- functions need no grant.
do $$
declare
  fn record;
begin
  for fn in
    select
      p.oid,
      p.oid::regprocedure as signature,
      p.prorettype in ('trigger'::regtype, 'event_trigger'::regtype) as is_trigger,
      has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can,
      has_function_privilege('service_role', p.oid, 'EXECUTE') as service_can
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and p.proowner = (select oid from pg_roles where rolname = current_user)
      and p.oid <> 'public.verify_business_document(text)'::regprocedure
      and not exists (
        select 1
        from pg_depend d
        where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e'
      )
  loop
    execute format('revoke execute on routine %s from public, anon', fn.signature);

    if not fn.is_trigger then
      if fn.authenticated_can and not has_function_privilege('authenticated', fn.oid, 'EXECUTE') then
        execute format('grant execute on routine %s to authenticated', fn.signature);
      end if;
      if fn.service_can and not has_function_privilege('service_role', fn.oid, 'EXECUTE') then
        execute format('grant execute on routine %s to service_role', fn.signature);
      end if;
    end if;
  end loop;
end
$$;

revoke execute on function public.verify_business_document(text) from public;
grant execute on function public.verify_business_document(text) to anon, authenticated;

-- Functions created by later migrations start without PUBLIC or anon EXECUTE and
-- need an explicit grant to authenticated or service_role.
alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;
alter default privileges in schema private revoke execute on functions from anon;

do $$
declare
  leftover text;
begin
  select string_agg(p.oid::regprocedure::text, ', ')
  into leftover
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private')
    and has_function_privilege('anon', p.oid, 'EXECUTE')
    and p.oid <> 'public.verify_business_document(text)'::regprocedure;

  if leftover is not null then
    raise exception 'anon can still execute: %', leftover;
  end if;
end
$$;
