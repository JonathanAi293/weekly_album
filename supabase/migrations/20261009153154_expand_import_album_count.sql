-- Expand manual imports while preserving the deployed function body and privileges.
do $migration$
declare
  v_definition text := pg_get_functiondef('public.import_friday_issue(uuid,jsonb)'::regprocedure);
begin
  if position('not between 5 and 8' in v_definition) = 0 then
    if position('not between 2 and 14' in v_definition) > 0 then
      return;
    end if;
    raise exception 'Unexpected import_friday_issue album-count guard; inspect before updating';
  end if;
  v_definition := replace(v_definition, 'not between 5 and 8', 'not between 2 and 14');
  v_definition := replace(v_definition, 'An issue must contain 5 to 8 albums', 'An issue must contain 2 to 14 albums');
  execute v_definition;
end;
$migration$;

