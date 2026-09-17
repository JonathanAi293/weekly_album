-- 手动 ChatGPT 交换模式：导入专栏、导出反馈；不保留站内 AI 调用或用量日志。

alter table public.issues add column if not exists subtitle text;
alter table public.feedback add column if not exists last_exported_at timestamptz;

create table if not exists public.import_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  issue_id uuid not null references public.issues(id) on delete cascade,
  schema_version text not null,
  raw_payload jsonb not null,
  imported_at timestamptz not null default now()
);

create table if not exists public.export_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  export_type text not null check (export_type in ('issue', 'changes')),
  issue_id uuid references public.issues(id) on delete set null,
  content_snapshot text not null,
  feedback_snapshot jsonb not null default '[]',
  item_count integer not null default 0 check (item_count >= 0),
  confirmed_at timestamptz not null default now()
);

create index if not exists import_runs_user_imported_idx on public.import_runs(user_id, imported_at desc);
create index if not exists export_runs_user_confirmed_idx on public.export_runs(user_id, confirmed_at desc);
create index if not exists feedback_user_exported_idx on public.feedback(user_id, last_exported_at);

alter table public.import_runs enable row level security;
alter table public.export_runs enable row level security;
-- Import/export records are intentionally server-only; browser sessions receive no policy.

-- Remove the previous in-app AI persistence and publishing functions. This migration does not touch albums,
-- issues, recommendations, feedback, or preference profiles.
drop index if exists public.one_active_weekly_generation_per_user;
drop function if exists public.replace_preference_profile(uuid, jsonb, text, integer);
drop function if exists public.publish_generated_issue(jsonb);
drop table if exists public.generation_logs cascade;
alter table public.issues drop constraint if exists issues_status_check;
update public.issues set status = 'failed' where status = 'generating';
alter table public.issues add constraint issues_status_check check (status in ('draft', 'published', 'failed'));

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
begin
  if p_payload ->> 'schema_version' <> 'friday-records-v1' then
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
    -- Prefer a stable music metadata identifier before falling back to the canonical key.
    foreach v_external_id in array array['musicbrainz', 'spotify', 'apple_music', 'bandcamp'] loop
      if nullif(v_album -> 'links' ->> v_external_id, '') is not null then
        select id into v_album_id from public.albums
        where external_urls ->> v_external_id = v_album -> 'links' ->> v_external_id
        limit 1;
        exit when v_album_id is not null;
      end if;
    end loop;
    if v_album_id is null then
      select id into v_album_id from public.albums where canonical_key = v_album ->> 'canonical_key' limit 1;
    end if;

    if v_album_id is null then
      insert into public.albums(canonical_key, title, artist, cover_url, release_date, release_year, tags, external_urls)
      values (
        v_album ->> 'canonical_key', v_album ->> 'title', v_album ->> 'artist', nullif(v_album ->> 'cover_url', ''),
        (v_album ->> 'release_date')::date, (v_album ->> 'release_year')::smallint,
        coalesce(array(select jsonb_array_elements_text(v_album -> 'tags')), '{}'), coalesce(v_album -> 'links', '{}'::jsonb)
      ) returning id into v_album_id;
    else
      update public.albums set
        title = v_album ->> 'title', artist = v_album ->> 'artist',
        cover_url = coalesce(nullif(v_album ->> 'cover_url', ''), cover_url),
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

create or replace function public.confirm_feedback_export(
  p_user_id uuid,
  p_export_type text,
  p_issue_id uuid,
  p_content text,
  p_items jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_run_id uuid;
  v_item jsonb;
  v_count integer := 0;
  v_now timestamptz := now();
begin
  if p_export_type not in ('issue', 'changes') then raise exception 'Invalid export type'; end if;
  if jsonb_typeof(p_items) <> 'array' then raise exception 'Invalid export snapshot'; end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    update public.feedback set last_exported_at = v_now
    where id = (v_item ->> 'id')::uuid
      and user_id = p_user_id
      and updated_at = (v_item ->> 'updated_at')::timestamptz;
    if found then v_count := v_count + 1; end if;
  end loop;

  insert into public.export_runs(user_id, export_type, issue_id, content_snapshot, feedback_snapshot, item_count, confirmed_at)
  values (p_user_id, p_export_type, p_issue_id, p_content, p_items, v_count, v_now)
  returning id into v_run_id;
  return v_run_id;
end;
$$;

revoke all on function public.import_friday_issue(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.import_friday_issue(uuid, jsonb) to service_role;
revoke all on function public.confirm_feedback_export(uuid, text, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.confirm_feedback_export(uuid, text, uuid, text, jsonb) to service_role;
