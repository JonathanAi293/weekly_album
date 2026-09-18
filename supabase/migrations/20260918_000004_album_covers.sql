-- Dedicated, non-searching cover sources. Existing albums.cover_url remains the legacy fallback.
alter table public.albums add column if not exists musicbrainz_release_group_id uuid;
alter table public.albums add column if not exists cover_fallback_url text;
alter table public.albums add column if not exists manual_cover_url text;

create index if not exists albums_release_group_mbid_idx on public.albums(musicbrainz_release_group_id) where musicbrainz_release_group_id is not null;

-- v1 remains importable. v2 adds a verified MusicBrainz Release Group MBID and a fallback image URL.
create or replace function public.import_friday_issue(p_user_id uuid, p_payload jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_issue_id uuid;
  v_album_id uuid;
  v_album jsonb;
  v_sources jsonb;
  v_order smallint := 0;
  v_issue jsonb := p_payload -> 'issue';
  v_external_id text;
  v_release_group_id uuid;
begin
  if p_payload ->> 'schema_version' not in ('friday-records-v1', 'friday-records-v2') then
    raise exception 'Unsupported schema_version';
  end if;
  if jsonb_typeof(p_payload -> 'albums') <> 'array' or jsonb_array_length(p_payload -> 'albums') not between 5 and 8 then
    raise exception 'An issue must contain 5 to 8 albums';
  end if;
  if exists (select 1 from public.issues where issue_number = (v_issue ->> 'issue_number')::integer) then
    raise exception 'Issue number % already exists', v_issue ->> 'issue_number';
  end if;

  insert into public.issues(slug, issue_number, title, subtitle, editorial, published_at, status)
  values (
    v_issue ->> 'slug', (v_issue ->> 'issue_number')::integer, v_issue ->> 'title',
    nullif(v_issue ->> 'subtitle', ''), nullif(v_issue ->> 'intro', ''),
    (v_issue ->> 'publish_date')::date, 'published'
  ) returning id into v_issue_id;

  for v_album in select value from jsonb_array_elements(p_payload -> 'albums') loop
    v_order := v_order + 1;
    v_album_id := null;
    v_release_group_id := nullif(v_album -> 'cover' ->> 'musicbrainz_release_group_id', '')::uuid;

    -- A verified release-group identity wins over all other dedupe keys.
    if v_release_group_id is not null then
      select id into v_album_id from public.albums where musicbrainz_release_group_id = v_release_group_id limit 1;
    end if;
    if v_album_id is null then
      foreach v_external_id in array array['musicbrainz', 'spotify', 'apple_music', 'bandcamp'] loop
        if nullif(v_album -> 'links' ->> v_external_id, '') is not null then
          select id into v_album_id from public.albums
          where external_urls ->> v_external_id = v_album -> 'links' ->> v_external_id
          limit 1;
          exit when v_album_id is not null;
        end if;
      end loop;
    end if;
    if v_album_id is null then
      select id into v_album_id from public.albums where canonical_key = v_album ->> 'canonical_key' limit 1;
    end if;

    if v_album_id is null then
      insert into public.albums(
        canonical_key, title, artist, cover_url, musicbrainz_release_group_id, cover_fallback_url,
        release_date, release_year, tags, external_urls
      ) values (
        v_album ->> 'canonical_key', v_album ->> 'title', v_album ->> 'artist', nullif(v_album ->> 'cover_url', ''),
        v_release_group_id, nullif(v_album -> 'cover' ->> 'fallback_url', ''),
        (v_album ->> 'release_date')::date, (v_album ->> 'release_year')::smallint,
        coalesce(array(select jsonb_array_elements_text(v_album -> 'tags')), '{}'), coalesce(v_album -> 'links', '{}'::jsonb)
      ) returning id into v_album_id;
    else
      update public.albums set
        title = v_album ->> 'title', artist = v_album ->> 'artist',
        -- Legacy cover_url is never cleared by v2. Manual cover is intentionally never touched here.
        cover_url = coalesce(nullif(v_album ->> 'cover_url', ''), cover_url),
        musicbrainz_release_group_id = coalesce(musicbrainz_release_group_id, v_release_group_id),
        cover_fallback_url = coalesce(nullif(v_album -> 'cover' ->> 'fallback_url', ''), cover_fallback_url),
        release_date = (v_album ->> 'release_date')::date, release_year = (v_album ->> 'release_year')::smallint,
        tags = coalesce(array(select jsonb_array_elements_text(v_album -> 'tags')), '{}'),
        external_urls = external_urls || coalesce(v_album -> 'links', '{}'::jsonb)
      where id = v_album_id;
    end if;

    v_sources := coalesce(v_album -> 'review_sources', '[]'::jsonb);
    insert into public.recommendations(issue_id, album_id, recommendation_reason, review_summary, source_refs, recommendation_type, display_order)
    values (
      v_issue_id, v_album_id, v_album ->> 'recommendation_reason', v_album ->> 'review_summary',
      v_sources, (v_album ->> 'recommendation_type')::public.recommendation_type, v_order
    );
  end loop;

  insert into public.import_runs(user_id, issue_id, schema_version, raw_payload)
  values (p_user_id, v_issue_id, p_payload ->> 'schema_version', p_payload);
  return v_issue_id;
end;
$$;

revoke all on function public.import_friday_issue(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.import_friday_issue(uuid, jsonb) to service_role;
