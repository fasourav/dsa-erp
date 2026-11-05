-- Forward fix for public.save_vendor. Depends on
-- 20261106024500_atomic_save_vendor.sql and does not edit that file:
-- the test database already applied it.
--
-- Same signature, SECURITY INVOKER, and authenticated-only execute grant.
-- Vendor writes still follow the caller's RLS. Category inserts stay owner-only.
--
-- On PostgreSQL 16, SELECT FOR UPDATE applies the UPDATE policy as well as
-- the SELECT policy. A caller who can see a vendor but cannot edit it used
-- to get P0002 ("not found") from that locked read, and never reached the
-- UPDATE. A row that fails the SELECT policy still gets that same P0002, so
-- a missing id and a hidden id stay indistinguishable. This function reads
-- with a plain SELECT first, and only then checks edit permission.
--
-- If UPDATE ... RETURNING still matches no row after that (a BEFORE trigger
-- skips the row, or the UPDATE policy is stricter than private.can), a caller
-- who cannot edit gets 42501. That is not reported as a stale 40001.
--
-- After the first category lookup misses, this takes a transaction advisory
-- lock on the normalized name and reads again. That closes the
-- read-committed gap between two save_vendor calls. A catalog insert that
-- does not take this lock (the Settings screen) can still commit after the
-- second read starts. The recheck does not remove that race.

create or replace function public.save_vendor(
  p_id uuid default null,
  p_version timestamptz default null,
  p_kind public.vendor_kind default null,
  p_person_name text default null,
  p_company_name text default null,
  p_vendor_field text default null,
  p_email text default null,
  p_phone text default null,
  p_address text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_prev_field text := null;
  v_current_version timestamptz := null;
  v_submitted_field text := nullif(btrim(coalesce(p_vendor_field, '')), '');
  v_prev_trimmed text := null;
  v_final_field text := null;
  v_category_exists boolean := false;
  v_next_sort integer := 10;
  v_saved_id uuid := null;
  v_saved_version timestamptz := null;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.' using errcode = '42501';
  end if;

  if p_id is not null then
    if p_version is null then
      raise exception 'Record version is required to update a vendor.' using errcode = '22023';
    end if;

    -- Plain SELECT uses only the SELECT policy. SELECT FOR UPDATE on
    -- PostgreSQL 16 also requires the UPDATE policy, which hides a visible
    -- vendor from a caller who cannot edit it.
    select v.vendor_field, v.updated_at
    into v_prev_field, v_current_version
    from public.vendors v
    where v.id = p_id;

    if not found then
      raise exception 'That vendor could not be found.' using errcode = 'P0002';
    end if;

    if not private.can('vendors', 'edit') then
      raise exception 'You do not have permission to edit vendors.' using errcode = '42501';
    end if;

    -- Lock the target row so no concurrent update can occur between
    -- category resolution and the vendor update.
    select v.vendor_field, v.updated_at
    into v_prev_field, v_current_version
    from public.vendors v
    where v.id = p_id
    for update;

    if not found then
      raise exception 'That vendor could not be found.' using errcode = 'P0002';
    end if;

    if v_current_version is distinct from p_version then
      raise exception 'This record was changed by someone else — reload.' using errcode = '40001';
    end if;

    v_prev_trimmed := nullif(btrim(coalesce(v_prev_field, '')), '');
  elsif not private.can('vendors', 'add') then
    raise exception 'You do not have permission to add vendors.' using errcode = '42501';
  end if;

  if v_submitted_field is not null then
    if p_id is not null
       and v_prev_trimmed is not null
       and lower(v_submitted_field) = lower(v_prev_trimmed) then
      -- Unchanged category on an existing vendor (including a deleted historical category):
      -- preserve stored value without querying or inserting into vendor_work_categories.
      v_final_field := v_prev_trimmed;
    else
      v_final_field := v_submitted_field;

      select exists (
        select 1
        from public.vendor_work_categories c
        where lower(btrim(c.name)) = lower(v_submitted_field)
      )
      into v_category_exists;

      if not v_category_exists then
        -- Serializes with other save_vendor calls for this name, then re-reads
        -- committed rows. Does not see a Settings insert that commits after
        -- this second statement starts.
        perform pg_advisory_xact_lock(
          hashtext('public.vendor_work_categories:' || lower(v_submitted_field))
        );

        select exists (
          select 1
          from public.vendor_work_categories c
          where lower(btrim(c.name)) = lower(v_submitted_field)
        )
        into v_category_exists;
      end if;

      if not v_category_exists then
        if not private.is_owner() then
          raise exception 'Only owners can add new vendor categories.' using errcode = '42501';
        end if;

        select ((coalesce(max(c.sort_order), 0) / 10)::integer + 1) * 10
        into v_next_sort
        from public.vendor_work_categories c;

        insert into public.vendor_work_categories (name, sort_order)
        values (v_submitted_field, coalesce(v_next_sort, 10))
        on conflict ((lower(trim(name)))) do nothing;
      end if;
    end if;
  end if;

  if p_id is not null then
    update public.vendors v
    set
      kind = p_kind,
      person_name = p_person_name,
      company_name = p_company_name,
      vendor_field = v_final_field,
      email = p_email,
      phone = p_phone,
      address = p_address,
      notes = p_notes,
      updated_at = p_version
    where v.id = p_id
      and v.updated_at = p_version
    returning v.id, v.updated_at
    into v_saved_id, v_saved_version;

    if v_saved_id is null then
      -- UPDATE policy denial returns zero rows and does not raise. Do not
      -- call that a version conflict. A real conflict was already raised
      -- from the locked row above when the caller is allowed to edit.
      if not private.can('vendors', 'edit') then
        raise exception 'You do not have permission to edit vendors.' using errcode = '42501';
      end if;

      raise exception 'This record was changed by someone else — reload.' using errcode = '40001';
    end if;
  else
    insert into public.vendors (
      kind,
      person_name,
      company_name,
      vendor_field,
      email,
      phone,
      address,
      notes
    )
    values (
      p_kind,
      p_person_name,
      p_company_name,
      v_final_field,
      p_email,
      p_phone,
      p_address,
      p_notes
    )
    returning id, updated_at
    into v_saved_id, v_saved_version;
  end if;

  return jsonb_build_object(
    'id', v_saved_id,
    'version', v_saved_version
  );
end;
$$;

revoke all on function public.save_vendor(
  uuid, timestamptz, public.vendor_kind, text, text, text, text, text, text, text
) from public, anon;

grant execute on function public.save_vendor(
  uuid, timestamptz, public.vendor_kind, text, text, text, text, text, text, text
) to authenticated;
