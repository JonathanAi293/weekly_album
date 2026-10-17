-- Integration regression. Always rolls back; never publishes or retains fixtures.
begin;
do $test$
<<test>>
declare
  u uuid; original public.albums%rowtype; original_json jsonb; feedback_json jsonb;
  payload jsonb; album_payload jsonb; saved jsonb; issue_id uuid; created_album uuid;
  issue_version text; initial_count integer; fp text; edited_version timestamptz;
begin
  select user_id into u from public.feedback limit 1;
  select * into original from public.albums order by id limit 1;
  original_json:=to_jsonb(original);
  select coalesce(jsonb_agg(to_jsonb(f) order by id),'[]') into feedback_json from public.feedback f where album_id=original.id;
  album_payload:=jsonb_build_object('title','Editorial rollback fixture','artist','Test only','release_year',2026,'release_date',null,
    'canonical_key','editorial-rollback-fixture-2026','tags',jsonb_build_array('Test'),
    'recommendation_type','taste_match','recommendation_reason','','review_summary','','review_sources','[]'::jsonb,'original_index',0);
  payload:=jsonb_build_object('mode','create','schema_version','friday-records-v2','catalog_fingerprint',public.get_import_catalog(u)->>'fingerprint',
    'issue',jsonb_build_object('issue_number',990101,'slug','editorial-rollback-test','title','Rollback draft','publish_date','2026-10-17','status','draft'),
    'albums',jsonb_build_array(album_payload));
  saved:=public.save_editorial_batch(u,payload);
  issue_id:=(saved->>'issue_id')::uuid; created_album:=(saved->'albums'->0->>'album_id')::uuid;
  if (select status from public.issues where id=issue_id)<>'draft' then raise exception 'Draft auto-published';end if;
  if (select release_date from public.albums where id=created_album) is not null then raise exception 'Invented release date';end if;
  select updated_at::text into issue_version from public.issues where id=issue_id;
  payload:=jsonb_build_object('mode','append','schema_version','friday-records-albums-v1','issue_id',issue_id,'issue_version',issue_version,
    'catalog_fingerprint',public.get_import_catalog(u)->>'fingerprint','albums',jsonb_build_array(album_payload||jsonb_build_object('existing_album_id',original.id)));
  perform public.save_editorial_batch(u,payload);
  if (select status from public.issues where id=issue_id)<>'draft' or (select title from public.issues where id=issue_id)<>'Rollback draft' then raise exception 'Append changed issue content/status';end if;
  if (select to_jsonb(a) from public.albums a where id=original.id) is distinct from original_json then raise exception 'Reused album overwritten';end if;
  if (select coalesce(jsonb_agg(to_jsonb(f) order by id),'[]') from public.feedback f where album_id=original.id) is distinct from feedback_json then raise exception 'Feedback overwritten';end if;
  select updated_at::text into issue_version from public.issues where id=issue_id;
  fp:=public.get_import_catalog(u)->>'fingerprint';
  payload:=payload||jsonb_build_object('issue_version',issue_version,'catalog_fingerprint',fp);
  begin
    perform public.save_editorial_batch(u,payload);
    raise exception 'Same-issue duplicate accepted';
  exception when others then if sqlerrm<>'ALBUM_ALREADY_IN_ISSUE' then raise;end if;end;
  if (select count(*) from public.recommendations r where r.issue_id=test.issue_id)<>2 then raise exception 'Partial duplicate write';end if;
  payload:=payload||jsonb_build_object('catalog_fingerprint','stale');
  begin
    perform public.save_editorial_batch(u,payload);
    raise exception 'Stale preview accepted';
  exception when others then if sqlerrm<>'IMPORT_CATALOG_CHANGED' then raise;end if;end;
  payload:=payload||jsonb_build_object('catalog_fingerprint',fp,'issue_version','2000-01-01');
  begin
    perform public.save_editorial_batch(u,payload);
    raise exception 'Stale issue accepted';
  exception when others then if sqlerrm<>'EDITORIAL_CHANGED' then raise;end if;end;
  payload:=payload||jsonb_build_object('issue_version',issue_version,'albums',
    (select jsonb_agg(album_payload||jsonb_build_object('title','Fixture '||n,'canonical_key','editorial-rollback-fixture-'||n,'original_index',n-1)) from generate_series(1,14) n));
  perform public.save_editorial_batch(u,payload);
  if (select count(*) from public.recommendations r where r.issue_id=test.issue_id)<>16 or (select max(display_order) from public.recommendations r where r.issue_id=test.issue_id)<>16 then raise exception 'Append beyond 14 failed';end if;
  select updated_at into edited_version from public.issues where id=test.issue_id;
  perform public.edit_editorial_record('issue',issue_id,edited_version,jsonb_build_object('title','Edited title','publish_date','2026-10-17','status','published'));
  if (select status from public.issues where id=test.issue_id)<>'published' then raise exception 'Publish failed';end if;
  -- Recommendation edits are per-issue; album identity and personal feedback remain shared.
  select updated_at into edited_version from public.recommendations r where r.issue_id=test.issue_id and album_id=created_album;
  perform public.edit_editorial_record('recommendation',
    (select id from public.recommendations r where r.issue_id=test.issue_id and album_id=created_album),edited_version,
    jsonb_build_object('recommendation_reason','Edited note','review_summary','','review_sources','[]'::jsonb,'recommendation_type','exploration'));
  if (select recommendation_reason from public.recommendations r where r.issue_id=test.issue_id and album_id=created_album)<>'Edited note' then raise exception 'Recommendation edit failed';end if;
  update public.albums set manual_cover_url='https://example.com/manual-preserved.jpg' where id=created_album;
  insert into public.feedback(user_id,album_id,listening_status,rating_status,rating,review)
  values(u,created_album,'listened','rated',7.5,'Preserve this feedback');
  select updated_at into edited_version from public.albums where id=created_album;
  perform public.edit_editorial_record('album',created_album,edited_version,album_payload||jsonb_build_object('title','Edited shared title',
    'canonical_key','editorial-rollback-fixture-edited','catalog_fingerprint',public.get_import_catalog(null)->>'fingerprint'));
  if (select title from public.albums where id=created_album)<>'Edited shared title'
    or (select manual_cover_url from public.albums where id=created_album)<>'https://example.com/manual-preserved.jpg'
    or (select rating from public.feedback where album_id=created_album and user_id=u)<>7.5
    or (select review from public.feedback where album_id=created_album and user_id=u)<>'Preserve this feedback' then raise exception 'Shared metadata edit damaged user record';end if;
  begin
    perform public.edit_editorial_record('issue',issue_id,'2000-01-01',jsonb_build_object('title','Must fail','publish_date','2026-10-17','status','draft'));
    raise exception 'Stale edit accepted';
  exception when others then if sqlerrm<>'EDITORIAL_CHANGED' then raise;end if;end;
end;
$test$;
rollback;
select not exists(select 1 from public.issues where issue_number=990101) as no_test_issue,
 not exists(select 1 from public.albums where canonical_key like 'editorial-rollback-fixture%') as no_test_albums,
 has_function_privilege('anon','public.save_editorial_batch(uuid,jsonb)','execute') as anon_can_save,
 has_function_privilege('authenticated','public.edit_editorial_record(text,uuid,timestamptz,jsonb)','execute') as client_can_edit,
 has_function_privilege('service_role','public.save_editorial_batch(uuid,jsonb)','execute') as server_can_save;
