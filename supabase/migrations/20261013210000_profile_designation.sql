-- Optional designation on profiles, edited by owners.
-- Members rename themselves through set_own_display_name, which only writes display_name.
-- public.set_own_display_name is security invoker. The private helper is security definer
-- so it can update the caller's row without opening profiles to self-service role edits.
-- authenticated may execute both. anon and public may not.

alter table public.profiles
  add column if not exists designation text;

alter table public.profiles
  drop constraint if exists profiles_designation_length;

alter table public.profiles
  add constraint profiles_designation_length
  check (
    designation is null
    or char_length(btrim(designation)) between 1 and 80
  );

create or replace function private.set_own_display_name(next_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;

  cleaned := nullif(btrim(regexp_replace(coalesce(next_name, ''), '\s+', ' ', 'g')), '');
  if cleaned is null then
    raise exception 'Enter a full name.';
  end if;
  if char_length(cleaned) > 120 then
    raise exception 'Use a shorter name.';
  end if;

  update public.profiles
  set display_name = cleaned
  where id = auth.uid();

  if not found then
    raise exception 'Your profile could not be found.';
  end if;
end;
$$;

create or replace function public.set_own_display_name(next_name text)
returns void
language sql
security invoker
set search_path = public
as $$
  select private.set_own_display_name(next_name);
$$;

revoke all on function private.set_own_display_name(text) from public, anon, authenticated, service_role;
grant execute on function private.set_own_display_name(text) to authenticated;

revoke all on function public.set_own_display_name(text) from public, anon, authenticated, service_role;
grant execute on function public.set_own_display_name(text) to authenticated;
