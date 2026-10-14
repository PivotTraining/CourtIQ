-- Ownership-only compatibility repair. Does not backfill, delete, or reassign
-- any customer row. Preserve the installed ledger implementation and its ACL.
do $repair$
declare
  definition text;
  replaced text;
  old_predicate constant text := 'owner_id[[:space:]]*=[[:space:]]*auth\.uid\(\)';
  new_predicate constant text := 'manager_uid = (select auth.uid())::text';
  matches integer;
begin
  select pg_get_functiondef('public.apply_session_command(uuid,uuid,integer,jsonb)'::regprocedure)
    into definition;
  if not exists (select 1 from information_schema.columns
      where table_schema='public' and table_name='players'
        and column_name='manager_uid' and data_type='text' and is_nullable='NO') then
    raise exception 'Verified manager ownership column is required';
  end if;
  select count(*) into matches from regexp_matches(definition, old_predicate, 'g');
  if matches=0 and position(new_predicate in definition)>0 then return; end if;
  if matches<>1 or position('Session unavailable' in definition)=0
      or position('Authentication required' in definition)=0 then
    raise exception 'Unexpected tracker function; inspect before repairing';
  end if;
  replaced := regexp_replace(definition, old_predicate, new_predicate);
  execute replaced;
end
$repair$;
