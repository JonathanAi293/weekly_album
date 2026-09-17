-- OpenAI manual-generation support. No scheduler is created here.

alter table public.issues drop constraint if exists issues_status_check;
alter table public.issues add constraint issues_status_check check (status in ('draft', 'generating', 'published', 'failed'));

alter table public.generation_logs add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.generation_logs add column if not exists model text;
alter table public.generation_logs add column if not exists input_tokens integer check (input_tokens is null or input_tokens >= 0);
alter table public.generation_logs add column if not exists output_tokens integer check (output_tokens is null or output_tokens >= 0);
alter table public.generation_logs add column if not exists web_search_count integer not null default 0 check (web_search_count >= 0);
create index if not exists generation_logs_user_started_idx on public.generation_logs(user_id, started_at desc);
create unique index if not exists one_active_weekly_generation_per_user on public.generation_logs(user_id, generation_type) where status = 'started' and generation_type = 'weekly_issue';

create or replace function public.replace_preference_profile(
  p_user_id uuid,
  p_profile_json jsonb,
  p_profile_text text,
  p_source_feedback_count integer
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_version integer; v_id uuid;
begin
  select coalesce(max(version), 0) + 1 into v_version from preference_profiles where user_id = p_user_id;
  update preference_profiles set is_active = false where user_id = p_user_id and is_active;
  insert into preference_profiles(user_id, profile_json, profile_text, version, source_feedback_count, is_active)
  values (p_user_id, p_profile_json, p_profile_text, v_version, p_source_feedback_count, true)
  returning id into v_id;
  return v_id;
end;
$$;

-- These SECURITY DEFINER functions must only be reachable by the server-side
-- secret key (service_role), never by browser sessions using anon/authenticated.
revoke all on function public.replace_preference_profile(uuid, jsonb, text, integer) from public, anon, authenticated;
grant execute on function public.replace_preference_profile(uuid, jsonb, text, integer) to service_role;

create or replace function public.publish_generated_issue(p_payload jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_issue_id uuid;
  v_album_id uuid;
  v_album jsonb;
  v_order smallint := 0;
begin
  if jsonb_typeof(p_payload -> 'albums') <> 'array' or jsonb_array_length(p_payload -> 'albums') not between 5 and 8 then
    raise exception 'Generated issue must contain 5–8 albums';
  end if;

  insert into issues(slug, issue_number, title, editorial, published_at, status)
  values (
    p_payload -> 'issue' ->> 'slug',
    (p_payload -> 'issue' ->> 'issue_number')::integer,
    p_payload -> 'issue' ->> 'title',
    p_payload -> 'issue' ->> 'editorial',
    (p_payload -> 'issue' ->> 'published_at')::timestamptz,
    'published'
  ) returning id into v_issue_id;

  for v_album in select value from jsonb_array_elements(p_payload -> 'albums') loop
    v_order := v_order + 1;
    insert into albums(canonical_key, title, artist, cover_url, release_date, release_year, tags, external_urls)
    values (
      v_album ->> 'canonical_key', v_album ->> 'title', v_album ->> 'artist', nullif(v_album ->> 'cover_url', ''),
      (v_album ->> 'release_date')::date, (v_album ->> 'release_year')::smallint,
      coalesce(array(select jsonb_array_elements_text(v_album -> 'tags')), '{}'),
      jsonb_build_object('sources', coalesce(v_album -> 'source_refs', '[]'::jsonb))
    )
    on conflict (canonical_key) do update set
      title = excluded.title, artist = excluded.artist,
      cover_url = coalesce(excluded.cover_url, albums.cover_url),
      release_date = excluded.release_date, release_year = excluded.release_year,
      tags = excluded.tags, external_urls = albums.external_urls
    returning id into v_album_id;

    insert into recommendations(issue_id, album_id, recommendation_reason, review_summary, source_refs, recommendation_type, display_order)
    values (
      v_issue_id, v_album_id, v_album ->> 'recommendation_reason', v_album ->> 'review_summary',
      coalesce(v_album -> 'source_refs', '[]'::jsonb), (v_album ->> 'recommendation_type')::recommendation_type, v_order
    );
  end loop;
  return v_issue_id;
end;
$$;

revoke all on function public.publish_generated_issue(jsonb) from public, anon, authenticated;
grant execute on function public.publish_generated_issue(jsonb) to service_role;
