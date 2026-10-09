-- One-time known history for Yours Sincerely.
-- Run after migration 20260928_000008_rating_history.sql in the Supabase SQL Editor.
-- This records the known 8.0 -> 7.5 second decision without changing the current score.

begin;

-- The counter is normally maintained only by the rating trigger. Temporarily
-- disable that trigger so this verified historical seed can set the count to 2.
alter table public.feedback disable trigger feedback_rating_history_counter;

do $seed_yours_sincerely$
declare
  v_album_id constant uuid := '0d24e3ff-0120-4aee-8138-d631e3b5b6b3';
  v_feedback public.feedback%rowtype;
  v_feedback_count integer;
  v_has_baseline boolean;
  v_has_index_two boolean;
  v_has_known_event boolean;
  v_has_later_events boolean;
begin
  select count(*) into v_feedback_count
  from public.feedback
  where album_id = v_album_id;

  if v_feedback_count <> 1 then
    raise exception 'Expected one feedback row for Yours Sincerely, found %', v_feedback_count;
  end if;

  select * into strict v_feedback
  from public.feedback
  where album_id = v_album_id
  for update;

  if v_feedback.rating_status <> 'rated' or v_feedback.rating is distinct from 7.5 then
    raise exception 'Yours Sincerely must currently be rated 7.5; current status/rating are % / %', v_feedback.rating_status, v_feedback.rating;
  end if;

  if v_feedback.rating_decision_count not in (1, 2) then
    raise exception 'Expected rating decision count 1 or 2; found %', v_feedback.rating_decision_count;
  end if;

  select exists (
    select 1 from public.rating_history
    where feedback_id = v_feedback.id
      and change_index = 1
      and is_baseline
      and new_rating_status = 'rated'
      and new_rating = 7.5
  ) into v_has_baseline;
  if not v_has_baseline then
    raise exception 'Expected the migration baseline of 7.5 for Yours Sincerely';
  end if;

  select exists (
    select 1 from public.rating_history
    where feedback_id = v_feedback.id and change_index = 2
  ) into v_has_index_two;

  select exists (
    select 1 from public.rating_history
    where feedback_id = v_feedback.id
      and change_index = 2
      and not is_baseline
      and previous_rating_status = 'rated'
      and previous_rating = 8.0
      and new_rating_status = 'rated'
      and new_rating = 7.5
  ) into v_has_known_event;

  select exists (
    select 1 from public.rating_history
    where feedback_id = v_feedback.id and change_index > 2
  ) into v_has_later_events;

  if v_has_index_two and not v_has_known_event then
    raise exception 'Rating history index 2 already contains a different event';
  end if;
  if v_has_later_events then
    raise exception 'Later rating history already exists; refusing to resequence it';
  end if;
  if v_feedback.rating_decision_count = 2 and not v_has_known_event then
    raise exception 'Rating count is already 2 but the expected 8.0 -> 7.5 event is missing';
  end if;

  if not v_has_known_event then
    insert into public.rating_history (
      feedback_id, album_id,
      previous_rating, new_rating,
      previous_rating_status, new_rating_status,
      change_index, is_baseline
    ) values (
      v_feedback.id, v_album_id,
      8.0, 7.5,
      'rated', 'rated',
      2, false
    );
  end if;

  update public.feedback
  set rating_decision_count = 2,
      -- Keep the known second decision pending for the next successful export.
      rating_history_exported_index = least(rating_history_exported_index, 1)
  where id = v_feedback.id;
end;
$seed_yours_sincerely$;

alter table public.feedback enable trigger feedback_rating_history_counter;
commit;
