-- Positive sequence numbers, without a product-level issue size limit.
alter table public.recommendations alter column display_order type integer;
alter table public.recommendations drop constraint recommendations_display_order_check;
alter table public.recommendations add constraint recommendations_display_order_check check (display_order > 0);

create or replace function public.save_editorial_batch(p_user_id uuid, p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_issue_id uuid; v_album_id uuid; v_album jsonb; v_order integer := 0;
  v_issue jsonb := p_payload -> 'issue'; v_target public.issues%rowtype;
  v_seen uuid[] := '{}'; v_saved jsonb := '[]'; v_created boolean;
begin
  lock table public.albums, public.recommendations, public.issues in share row exclusive mode;
  if nullif(p_payload ->> 'catalog_fingerprint', '') is null or
    p_payload ->> 'catalog_fingerprint' <> public.get_import_catalog(p_user_id) ->> 'fingerprint' then
    raise exception 'IMPORT_CATALOG_CHANGED';
  end if;
  if jsonb_typeof(p_payload -> 'albums') is distinct from 'array' or jsonb_array_length(p_payload -> 'albums') not between 1 and 14 then
    raise exception 'An operation must contain 1 to 14 albums';
  end if;
  if p_payload ->> 'mode' = 'append' then
    select * into v_target from public.issues where id=(p_payload ->> 'issue_id')::uuid;
    if not found then raise exception 'Target issue not found'; end if;
    if v_target.status not in ('draft','published') then raise exception 'Target issue not editable'; end if;
    if (p_payload ->> 'issue_version')::timestamptz is distinct from v_target.updated_at then raise exception 'EDITORIAL_CHANGED'; end if;
    v_issue_id := v_target.id;
    select coalesce(max(display_order),0) into v_order from public.recommendations where issue_id=v_issue_id;
  elsif p_payload ->> 'mode' = 'create' then
    if v_issue ->> 'status' is distinct from 'draft' then raise exception 'New manual issue must be draft'; end if;
    insert into public.issues(slug,issue_number,title,subtitle,editorial,published_at,status)
    values (v_issue ->> 'slug',(v_issue ->> 'issue_number')::integer,v_issue ->> 'title',
      nullif(v_issue ->> 'subtitle',''),nullif(v_issue ->> 'intro',''),(v_issue ->> 'publish_date')::date,'draft') returning id into v_issue_id;
  else raise exception 'Unknown editorial mode'; end if;
  for v_album in select value from jsonb_array_elements(p_payload -> 'albums') loop
    v_order := v_order + 1;
    v_album_id := nullif(v_album ->> 'existing_album_id','')::uuid;
    v_created := v_album_id is null;
    if v_album_id is not null then
      if not exists(select 1 from public.albums where id=v_album_id) then raise exception 'IMPORT_CATALOG_CHANGED'; end if;
    else
      insert into public.albums(canonical_key,title,artist,cover_url,musicbrainz_release_group_id,cover_fallback_url,release_date,release_year,tags,external_urls)
      values (v_album ->> 'canonical_key',v_album ->> 'title',v_album ->> 'artist',nullif(v_album ->> 'cover_url',''),
        nullif(v_album -> 'cover' ->> 'musicbrainz_release_group_id','')::uuid,nullif(v_album -> 'cover' ->> 'fallback_url',''),
        nullif(v_album ->> 'release_date','')::date,(v_album ->> 'release_year')::smallint,
        array(select jsonb_array_elements_text(v_album -> 'tags')),coalesce(v_album -> 'links','{}'::jsonb)) returning id into v_album_id;
    end if;
    if v_album_id = any(v_seen) or exists(select 1 from public.recommendations where issue_id=v_issue_id and album_id=v_album_id) then
      raise exception 'ALBUM_ALREADY_IN_ISSUE';
    end if;
    v_seen := array_append(v_seen,v_album_id);
    v_saved := v_saved || jsonb_build_array(jsonb_build_object('index',(v_album ->> 'original_index')::integer,'album_id',v_album_id,'created',v_created));
    insert into public.recommendations(issue_id,album_id,recommendation_reason,review_summary,source_refs,recommendation_type,display_order)
    values (v_issue_id,v_album_id,coalesce(v_album ->> 'recommendation_reason',''),coalesce(v_album ->> 'review_summary',''),
      coalesce(v_album -> 'review_sources','[]'::jsonb),(v_album ->> 'recommendation_type')::public.recommendation_type,v_order);
  end loop;
  -- Touch the target for optimistic concurrency, without changing its content/status.
  update public.issues set updated_at=clock_timestamp() where id=v_issue_id;
  insert into public.import_runs(user_id,issue_id,schema_version,raw_payload)
  values (p_user_id,v_issue_id,p_payload ->> 'schema_version',p_payload);
  return jsonb_build_object('issue_id',v_issue_id,'albums',v_saved);
end;
$$;
revoke all on function public.save_editorial_batch(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_editorial_batch(uuid,jsonb) to service_role;

create or replace function public.edit_editorial_record(p_kind text,p_id uuid,p_version timestamptz,p_value jsonb)
returns void language plpgsql security invoker set search_path = public as $$
declare n integer;
begin
  lock table public.albums, public.recommendations, public.issues in share row exclusive mode;
  if p_kind = 'issue' then
    if p_value ->> 'status' not in ('draft','published') then raise exception 'Invalid issue status'; end if;
    update public.issues set title=p_value ->> 'title',subtitle=nullif(p_value ->> 'subtitle',''),editorial=nullif(p_value ->> 'intro',''),
      published_at=(p_value ->> 'publish_date')::date,status=p_value ->> 'status'
    where id=p_id and updated_at=p_version;
  elsif p_kind = 'recommendation' then
    update public.recommendations set recommendation_reason=coalesce(p_value ->> 'recommendation_reason',''),
      review_summary=coalesce(p_value ->> 'review_summary',''),source_refs=coalesce(p_value -> 'review_sources','[]'::jsonb),
      recommendation_type=(p_value ->> 'recommendation_type')::public.recommendation_type
    where id=p_id and updated_at=p_version;
  elsif p_kind = 'album' then
    if p_value ->> 'catalog_fingerprint' is distinct from public.get_import_catalog(null)->>'fingerprint' then raise exception 'IMPORT_CATALOG_CHANGED'; end if;
    update public.albums set title=p_value ->> 'title',artist=p_value ->> 'artist',canonical_key=p_value ->> 'canonical_key',
      release_year=(p_value ->> 'release_year')::smallint,release_date=nullif(p_value ->> 'release_date','')::date,
      tags=array(select jsonb_array_elements_text(p_value -> 'tags')),external_urls=coalesce(p_value -> 'links','{}'::jsonb),
      musicbrainz_release_group_id=nullif(p_value -> 'cover' ->> 'musicbrainz_release_group_id','')::uuid,
      cover_fallback_url=nullif(p_value -> 'cover' ->> 'fallback_url','')
    where id=p_id and updated_at=p_version;
  else raise exception 'Unknown editor record'; end if;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'EDITORIAL_CHANGED'; end if;
end;
$$;
revoke all on function public.edit_editorial_record(text,uuid,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.edit_editorial_record(text,uuid,timestamptz,jsonb) to service_role;
