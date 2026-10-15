-- New documents have no id/version yet; the app omits them, and PostgREST can only match the
-- function if those params have defaults. Recreate save_business_document with optional id/version
-- (body, security and grants unchanged). Trailing params get DEFAULT NULL too, as Postgres requires;
-- the app always sends them.
drop function if exists public.save_business_document(text, uuid, timestamptz, jsonb, jsonb, jsonb);
create function public.save_business_document(
  p_kind text,
  p_id uuid default null,
  p_version timestamptz default null,
  p_fields jsonb default null,
  p_lines jsonb default null,
  p_milestones jsonb default null
)
returns jsonb
language plpgsql
security invoker
set search_path to ''
as $$
declare
  head_table text;
  line_table text;
  milestone_table text;
  fk text;
  doc_id uuid := p_id;
  doc_no text;
  token text;
  ver timestamptz;
begin
  if p_kind = 'quotation' then
    head_table := 'quotations'; line_table := 'quotation_lines';
    milestone_table := 'quotation_milestones'; fk := 'quotation_id';
  elsif p_kind = 'work_order' then
    head_table := 'work_orders'; line_table := 'work_order_lines';
    milestone_table := 'work_order_milestones'; fk := 'work_order_id';
  else
    raise exception 'Unknown document kind.' using errcode = '22023';
  end if;

  if doc_id is not null then
    execute format(
      'update public.%I as d set (%s) = (select %s from jsonb_populate_record(null::public.%I, $1) r), updated_at = coalesce($3, d.updated_at) where d.id = $2 returning d.document_no, d.verify_token, d.updated_at',
      head_table,
      (select string_agg(format('%I', key), ', ') from jsonb_object_keys(p_fields) key),
      (select string_agg(format('r.%I', key), ', ') from jsonb_object_keys(p_fields) key),
      head_table
    ) using p_fields, doc_id, p_version into doc_no, token, ver;
    if doc_no is null then
      raise exception 'That document could not be found.' using errcode = 'P0002';
    end if;
  else
    execute format(
      'insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1) r returning id, document_no, verify_token, updated_at',
      head_table,
      (select string_agg(format('%I', key), ', ') from jsonb_object_keys(p_fields) key),
      (select string_agg(format('r.%I', key), ', ') from jsonb_object_keys(p_fields) key),
      head_table
    ) using p_fields into doc_id, doc_no, token, ver;
  end if;

  execute format('delete from public.%I where %I = $1', line_table, fk) using doc_id;
  execute format(
    'insert into public.%I (%I, sort_order, section_name, item, specification, quantity, unit, unit_price)
     select $1, (r ->> ''sort_order'')::integer, coalesce(r ->> ''section_name'', ''''), r ->> ''item'',
            coalesce(r ->> ''specification'', ''''), (r ->> ''quantity'')::numeric, coalesce(r ->> ''unit'', ''''),
            (r ->> ''unit_price'')::numeric
     from jsonb_array_elements(coalesce($2, ''[]''::jsonb)) r',
    line_table, fk
  ) using doc_id, p_lines;

  execute format('delete from public.%I where %I = $1', milestone_table, fk) using doc_id;
  execute format(
    'insert into public.%I (%I, sort_order, label, percent)
     select $1, (r ->> ''sort_order'')::integer, r ->> ''label'', (r ->> ''percent'')::numeric
     from jsonb_array_elements(coalesce($2, ''[]''::jsonb)) r',
    milestone_table, fk
  ) using doc_id, p_milestones;

  return jsonb_build_object('id', doc_id, 'document_no', doc_no, 'verify_token', token, 'version', ver);
end;
$$;
revoke all on function public.save_business_document(text, uuid, timestamptz, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.save_business_document(text, uuid, timestamptz, jsonb, jsonb, jsonb) to authenticated;
notify pgrst, 'reload schema';
