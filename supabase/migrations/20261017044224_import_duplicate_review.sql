-- Read one consistent catalog snapshot. Service-role only; no new public data API.
create or replace function public.get_import_catalog(p_user_id uuid)
returns jsonb language sql stable security invoker set search_path = public as $$
  with catalog as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', a.id, 'canonical_key', a.canonical_key,
      'title', a.title, 'artist', a.artist, 'release_year', a.release_year,
      'musicbrainz_release_group_id', a.musicbrainz_release_group_id,
      'external_urls', a.external_urls,
      'issues', coalesce((select jsonb_agg(jsonb_build_object(
        'issue_number', i.issue_number, 'slug', i.slug,
        'published_at', i.published_at, 'status', i.status
      ) order by i.issue_number) from public.recommendations r
        join public.issues i on i.id = r.issue_id where r.album_id = a.id), '[]'::jsonb),
      'feedback', (select jsonb_build_object('listening_status', f.listening_status,
        'rating', f.rating, 'rating_status', f.rating_status)
        from public.feedback f where f.album_id = a.id and f.user_id = p_user_id)
    ) order by a.id), '[]'::jsonb) as albums from public.albums a
  ) select jsonb_build_object('albums', albums, 'fingerprint',
    md5((select coalesce(jsonb_agg(value - 'feedback'), '[]'::jsonb)
      from jsonb_array_elements(albums))::text)) from catalog;
$$;
revoke all on function public.get_import_catalog(uuid) from public, anon, authenticated;
grant execute on function public.get_import_catalog(uuid) to service_role;

-- New endpoint leaves the old deployed site compatible until frontend deployment.
-- Matching decisions are validated by the authenticated server; the fingerprint is
-- checked inside the write transaction so an intervening import cannot slip through.
create or replace function public.import_friday_issue_reviewed(p_user_id uuid, p_payload jsonb)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_issue_id uuid;
  v_album_id uuid;
  v_album jsonb;
  v_order smallint := 0;
  v_issue jsonb := p_payload -> 'issue';
  v_seen uuid[] := '{}';
begin
  lock table public.albums, public.recommendations, public.issues in share row exclusive mode;
  if nullif(p_payload ->> 'catalog_fingerprint', '') is null or
    p_payload ->> 'catalog_fingerprint' <> public.get_import_catalog(p_user_id) ->> 'fingerprint' then
    raise exception 'IMPORT_CATALOG_CHANGED';
  end if;
  if p_payload ->> 'schema_version' is null or p_payload ->> 'schema_version' not in ('friday-records-v1', 'friday-records-v2') then
    raise exception 'Unsupported schema_version';
  end if;
  if jsonb_typeof(p_payload -> 'albums') is distinct from 'array' or jsonb_array_length(p_payload -> 'albums') not between 2 and 14 then
    raise exception 'An issue must contain 2 to 14 albums';
  end if;
  if exists (select 1 from public.issues where issue_number = (v_issue ->> 'issue_number')::integer) then
    raise exception 'Issue number already exists';
  end if;
  insert into public.issues(slug, issue_number, title, subtitle, editorial, published_at, status)
  values (v_issue ->> 'slug', (v_issue ->> 'issue_number')::integer, v_issue ->> 'title',
    nullif(v_issue ->> 'subtitle', ''), nullif(v_issue ->> 'intro', ''),
    (v_issue ->> 'publish_date')::date, 'published') returning id into v_issue_id;
  for v_album in select value from jsonb_array_elements(p_payload -> 'albums') loop
    v_order := v_order + 1;
    v_album_id := nullif(v_album ->> 'existing_album_id', '')::uuid;
    if v_album_id is not null then
      if not exists (select 1 from public.albums where id = v_album_id) then
        raise exception 'IMPORT_CATALOG_CHANGED';
      end if;
      -- Reuse means no changes to metadata, release year, covers or user records.
    else
      insert into public.albums(canonical_key, title, artist, cover_url,
        musicbrainz_release_group_id, cover_fallback_url, release_date, release_year, tags, external_urls)
      values (v_album ->> 'canonical_key', v_album ->> 'title', v_album ->> 'artist',
        nullif(v_album ->> 'cover_url', ''), nullif(v_album -> 'cover' ->> 'musicbrainz_release_group_id', '')::uuid,
        nullif(v_album -> 'cover' ->> 'fallback_url', ''), (v_album ->> 'release_date')::date,
        (v_album ->> 'release_year')::smallint, array(select jsonb_array_elements_text(v_album -> 'tags')),
        coalesce(v_album -> 'links', '{}'::jsonb)) returning id into v_album_id;
    end if;
    if v_album_id = any(v_seen) then raise exception 'Duplicate album within issue'; end if;
    v_seen := array_append(v_seen, v_album_id);
    insert into public.recommendations(issue_id, album_id, recommendation_reason, review_summary, source_refs, recommendation_type, display_order)
    values (v_issue_id, v_album_id, v_album ->> 'recommendation_reason', v_album ->> 'review_summary',
      coalesce(v_album -> 'review_sources', '[]'::jsonb), (v_album ->> 'recommendation_type')::public.recommendation_type, v_order);
  end loop;
  insert into public.import_runs(user_id, issue_id, schema_version, raw_payload)
  values (p_user_id, v_issue_id, p_payload ->> 'schema_version', p_payload);
  return v_issue_id;
end;
$$;
revoke all on function public.import_friday_issue_reviewed(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.import_friday_issue_reviewed(uuid, jsonb) to service_role;
