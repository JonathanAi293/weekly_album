-- Preserve actual rating decisions while feedback continues to hold the current state.

alter table public.feedback
  add column if not exists rating_decision_count integer not null default 0;
alter table public.feedback
  add column if not exists rating_history_exported_index integer not null default 0;

alter table public.feedback
  drop constraint if exists feedback_rating_decision_count_check;
alter table public.feedback
  add constraint feedback_rating_decision_count_check
  check (rating_decision_count >= 0);
alter table public.feedback
  drop constraint if exists feedback_rating_history_exported_index_check;
alter table public.feedback
  add constraint feedback_rating_history_exported_index_check
  check (rating_history_exported_index >= 0 and rating_history_exported_index <= rating_decision_count);

-- Existing scores are the first known baseline. Do not touch updated_at: that is
-- also the feedback export cursor and must continue to describe user edits only.
alter table public.feedback disable trigger feedback_timestamps;
update public.feedback
set rating_decision_count = 1,
    rating_history_exported_index = case when last_exported_at is null then 0 else 1 end
where rating_status in ('rated', 'no_rating')
  and rating_decision_count = 0;
alter table public.feedback enable trigger feedback_timestamps;

-- Give edits a timestamp after any row-lock wait. Cursor-only writes performed
-- by export confirmation do not count as user feedback edits.
create or replace function public.set_feedback_timestamps()
returns trigger language plpgsql as $$
begin
  if new.listening_status is distinct from old.listening_status then
    new.status_updated_at := clock_timestamp();
  end if;

  if new.listening_status is distinct from old.listening_status
     or new.rating is distinct from old.rating
     or new.rating_status is distinct from old.rating_status
     or new.review is distinct from old.review then
    new.updated_at := clock_timestamp();
  else
    new.updated_at := old.updated_at;
  end if;
  return new;
end;
$$;

create table if not exists public.rating_history (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.feedback(id) on delete cascade,
  album_id uuid not null references public.albums(id) on delete cascade,
  previous_rating numeric(3,1),
  new_rating numeric(3,1),
  previous_rating_status public.rating_status,
  new_rating_status public.rating_status not null,
  change_index integer not null check (change_index > 0),
  is_baseline boolean not null default false,
  created_at timestamptz not null default now(),
  unique (feedback_id, change_index),
  check (previous_rating is null or (previous_rating >= 1.0 and previous_rating <= 10.0 and previous_rating * 2 = trunc(previous_rating * 2))),
  check (new_rating is null or (new_rating >= 1.0 and new_rating <= 10.0 and new_rating * 2 = trunc(new_rating * 2))),
  check (
    (previous_rating_status is null)
    or (previous_rating_status = 'rated' and previous_rating is not null)
    or (previous_rating_status in ('pending', 'no_rating') and previous_rating is null)
  ),
  check (
    (new_rating_status = 'rated' and new_rating is not null)
    or (new_rating_status in ('pending', 'no_rating') and new_rating is null)
  ),
  check (not is_baseline or (change_index = 1 and previous_rating is null and previous_rating_status is null))
);

create index if not exists rating_history_feedback_order_idx
  on public.rating_history(feedback_id, change_index);

alter table public.rating_history enable row level security;
revoke all on public.rating_history from public, anon, authenticated;
grant select, insert on public.rating_history to service_role;

-- Backfill only a marked baseline. Its date is not treated as a real rating
-- event and it is never printed in exports as a first rating or a score change.
insert into public.rating_history (
  feedback_id, album_id, previous_rating, new_rating,
  previous_rating_status, new_rating_status, change_index, is_baseline
)
select
  id, album_id, null, rating,
  null, rating_status, 1, true
from public.feedback
where rating_status in ('rated', 'no_rating')
on conflict (feedback_id, change_index) do nothing;

create or replace function public.capture_feedback_rating_history()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.rating_status in ('rated', 'no_rating') then
      new.rating_decision_count := 1;
    else
      new.rating_decision_count := 0;
    end if;
    return new;
  end if;

  if new.rating is distinct from old.rating
     or new.rating_status is distinct from old.rating_status then
    new.rating_decision_count := old.rating_decision_count + 1;
  else
    -- This count is maintained by the trigger, never by client input.
    new.rating_decision_count := old.rating_decision_count;
  end if;
  return new;
end;
$$;

create or replace function public.write_feedback_rating_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.rating_status in ('rated', 'no_rating') then
      insert into public.rating_history (
        feedback_id, album_id, previous_rating, new_rating,
        previous_rating_status, new_rating_status, change_index, is_baseline
      ) values (
        new.id, new.album_id, null, new.rating,
        null, new.rating_status, 1, false
      );
    end if;
    return new;
  end if;

  if new.rating is distinct from old.rating
     or new.rating_status is distinct from old.rating_status then
    insert into public.rating_history (
      feedback_id, album_id, previous_rating, new_rating,
      previous_rating_status, new_rating_status, change_index, is_baseline
    ) values (
      new.id, new.album_id, old.rating, new.rating,
      old.rating_status, new.rating_status, new.rating_decision_count, false
    );
  end if;
  return new;
end;
$$;

revoke all on function public.capture_feedback_rating_history() from public, anon, authenticated;
revoke all on function public.write_feedback_rating_history() from public, anon, authenticated;
drop trigger if exists feedback_rating_history_counter on public.feedback;
create trigger feedback_rating_history_counter
before insert or update on public.feedback
for each row execute function public.capture_feedback_rating_history();

drop trigger if exists feedback_rating_history_event on public.feedback;
create trigger feedback_rating_history_event
after insert or update on public.feedback
for each row execute function public.write_feedback_rating_history();

-- Keep the current-feedback cursor and the rating-history cursor in the same
-- atomic confirmation. A concurrent rating edit cannot be mistaken as exported.
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
    if not (v_item ? 'rating_decision_count') then
      raise exception 'Export snapshot is missing the rating history cursor';
    end if;
    update public.feedback
    set last_exported_at = v_now,
        rating_history_exported_index = (v_item ->> 'rating_decision_count')::integer
    where id = (v_item ->> 'id')::uuid
      and user_id = p_user_id
      and updated_at = (v_item ->> 'updated_at')::timestamptz
      and rating_decision_count = (v_item ->> 'rating_decision_count')::integer
      and listening_status in ('listened', 'not_interested');
    if found then v_count := v_count + 1; end if;
  end loop;

  if v_count <> jsonb_array_length(p_items) then
    raise exception 'Feedback changed after the export preview; generate a new preview before confirming';
  end if;

  insert into public.export_runs(user_id, export_type, issue_id, content_snapshot, feedback_snapshot, item_count, confirmed_at)
  values (p_user_id, p_export_type, p_issue_id, p_content, p_items, v_count, v_now)
  returning id into v_run_id;
  return v_run_id;
end;
$$;

revoke all on function public.confirm_feedback_export(uuid, text, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.confirm_feedback_export(uuid, text, uuid, text, jsonb) to service_role;
