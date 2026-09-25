-- Advance export cursors only for feedback in the current export allowlist.
-- This also protects against stale previews whose status changed before confirm.
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
      and updated_at = (v_item ->> 'updated_at')::timestamptz
      and listening_status in ('listened', 'not_interested');
    if found then v_count := v_count + 1; end if;
  end loop;

  insert into public.export_runs(user_id, export_type, issue_id, content_snapshot, feedback_snapshot, item_count, confirmed_at)
  values (p_user_id, p_export_type, p_issue_id, p_content, p_items, v_count, v_now)
  returning id into v_run_id;
  return v_run_id;
end;
$$;

revoke all on function public.confirm_feedback_export(uuid, text, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.confirm_feedback_export(uuid, text, uuid, text, jsonb) to service_role;
