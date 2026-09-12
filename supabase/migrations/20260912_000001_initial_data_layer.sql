-- 周五唱片室：Supabase 数据层基线 migration
-- 运行方式：Supabase CLI `supabase db push`，或在 SQL Editor 整段执行。
create extension if not exists pgcrypto;

do $$ begin create type public.recommendation_type as enum ('taste_match', 'exploration'); exception when duplicate_object then null; end $$;
do $$ begin create type public.listening_status as enum ('want_to_listen', 'listened', 'not_interested'); exception when duplicate_object then null; end $$;
do $$ begin create type public.rating_status as enum ('pending', 'no_rating', 'rated'); exception when duplicate_object then null; end $$;

create table if not exists public.albums (
  id uuid primary key default gen_random_uuid(),
  canonical_key text not null unique,
  title text not null,
  artist text not null,
  cover_url text,
  release_date date,
  release_year smallint not null check (release_year between 1900 and 2100),
  tags text[] not null default '{}',
  external_urls jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (release_date is null or extract(year from release_date)::smallint = release_year)
);

create table if not exists public.issues (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  issue_number integer not null unique check (issue_number > 0),
  title text not null,
  editorial text,
  published_at timestamptz not null,
  status text not null default 'published' check (status in ('draft', 'published', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues(id) on delete cascade,
  album_id uuid not null references public.albums(id) on delete restrict,
  recommendation_reason text not null,
  review_summary text not null,
  source_refs jsonb not null default '[]',
  recommendation_type public.recommendation_type not null,
  display_order smallint not null check (display_order between 1 and 8),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (issue_id, album_id),
  unique (issue_id, display_order)
);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  album_id uuid not null references public.albums(id) on delete cascade,
  listening_status public.listening_status,
  rating numeric(3,1),
  rating_status public.rating_status not null default 'pending',
  review text,
  status_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, album_id),
  check (rating is null or (rating >= 1.0 and rating <= 10.0 and rating * 2 = trunc(rating * 2))),
  check (
    (rating_status = 'pending' and rating is null)
    or (rating_status = 'no_rating' and rating is null)
    or (rating_status = 'rated' and rating is not null)
  ),
  check (review is null or char_length(review) <= 1200)
);

create table if not exists public.preference_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_json jsonb,
  profile_text text,
  version integer not null check (version > 0),
  source_feedback_count integer not null default 0 check (source_feedback_count >= 0),
  created_at timestamptz not null default now(),
  is_active boolean not null default true,
  unique (user_id, version),
  check (profile_json is not null or profile_text is not null)
);

create unique index if not exists one_active_preference_profile_per_user on public.preference_profiles(user_id) where is_active;

create table if not exists public.generation_logs (
  id uuid primary key default gen_random_uuid(),
  generation_type text not null check (generation_type in ('weekly_issue', 'profile_refresh')),
  status text not null check (status in ('started', 'succeeded', 'failed', 'skipped')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  metadata jsonb not null default '{}',
  error_message text,
  check (finished_at is null or finished_at >= started_at)
);

create index if not exists issues_published_at_idx on public.issues(published_at desc) where status = 'published';
create index if not exists recommendations_issue_order_idx on public.recommendations(issue_id, display_order);
create index if not exists recommendations_album_idx on public.recommendations(album_id);
create index if not exists albums_release_year_idx on public.albums(release_year desc);
create index if not exists feedback_user_status_order_idx on public.feedback(user_id, listening_status, status_updated_at desc);
create index if not exists feedback_user_album_idx on public.feedback(user_id, album_id);
create index if not exists feedback_user_rating_idx on public.feedback(user_id, rating desc) where rating_status = 'rated';

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create or replace function public.set_feedback_timestamps()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  if new.listening_status is distinct from old.listening_status then new.status_updated_at = now(); end if;
  return new;
end;
$$;

drop trigger if exists albums_updated_at on public.albums;
create trigger albums_updated_at before update on public.albums for each row execute function public.set_updated_at();
drop trigger if exists issues_updated_at on public.issues;
create trigger issues_updated_at before update on public.issues for each row execute function public.set_updated_at();
drop trigger if exists recommendations_updated_at on public.recommendations;
create trigger recommendations_updated_at before update on public.recommendations for each row execute function public.set_updated_at();
drop trigger if exists feedback_timestamps on public.feedback;
create trigger feedback_timestamps before update on public.feedback for each row execute function public.set_feedback_timestamps();

alter table public.albums enable row level security;
alter table public.issues enable row level security;
alter table public.recommendations enable row level security;
alter table public.feedback enable row level security;
alter table public.preference_profiles enable row level security;
alter table public.generation_logs enable row level security;

create policy "authenticated users can read albums" on public.albums for select to authenticated using (true);
create policy "authenticated users can read issues" on public.issues for select to authenticated using (true);
create policy "authenticated users can read recommendations" on public.recommendations for select to authenticated using (true);

create policy "users can read own feedback" on public.feedback for select to authenticated using (auth.uid() = user_id);
create policy "users can insert own feedback" on public.feedback for insert to authenticated with check (auth.uid() = user_id);
create policy "users can update own feedback" on public.feedback for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users can delete own feedback" on public.feedback for delete to authenticated using (auth.uid() = user_id);

create policy "users can read own preference profiles" on public.preference_profiles for select to authenticated using (auth.uid() = user_id);
-- No client policy is intentionally granted for preference profile writes or generation logs.
-- Future server jobs use SUPABASE_SERVICE_ROLE_KEY only in server runtime.
