begin;
create temporary table court_launch_fixture(owner_id uuid default gen_random_uuid(), other_id uuid default gen_random_uuid(), player_id uuid default gen_random_uuid(), session_id uuid default gen_random_uuid(), command_id uuid default gen_random_uuid(), completion_id uuid default gen_random_uuid()) on commit drop;
insert into court_launch_fixture default values;
grant select on court_launch_fixture to authenticated;
-- Synthetic rows exist only inside this rolled-back transaction. No emails,
-- provider calls, credentials, or existing customer rows are involved.
insert into auth.users(id) select owner_id from court_launch_fixture union all select other_id from court_launch_fixture;
select set_config('request.jwt.claim.sub',(select owner_id::text from court_launch_fixture),true);
set local role authenticated;
insert into public.players(id,firebase_uid,manager_uid,name) select player_id,owner_id::text,owner_id::text,'Rollback-only launch verification' from court_launch_fixture;
insert into public.sessions(id,player_id,type,mode,tracker_status,tracker_context) select session_id,player_id,'game','individual','active','{}'::jsonb from court_launch_fixture;
do $verify$
declare f record; payload jsonb; saved jsonb; rejected boolean:=false;
begin
 select * into f from court_launch_fixture;
 payload:=jsonb_build_object('kind','stat','key','ast','delta',1,'period',1,'clock','08:00','recorded_at','2026-10-14T16:00:00Z');
 if not exists(select 1 from public.players where id=f.player_id and owner_id=f.owner_id and manager_uid=f.owner_id::text) then raise exception 'Generated ownership did not match the manager'; end if;
 saved:=public.apply_session_command(f.session_id,f.command_id,0,payload);
 if (saved->'game_stats'->>'ast')::int<>1 or (saved->>'tracker_version')::int<>1 then raise exception 'First save failed'; end if;
 saved:=public.apply_session_command(f.session_id,f.command_id,0,payload);
 if (saved->'game_stats'->>'ast')::int<>1 or (saved->>'tracker_version')::int<>1 then raise exception 'Retry duplicated an event'; end if;
 perform set_config('request.jwt.claim.sub',f.other_id::text,true);
 if exists(select 1 from public.sessions where id=f.session_id) then raise exception 'Foreign account could read the session'; end if;
 begin perform public.apply_session_command(f.session_id,gen_random_uuid(),1,payload); exception when insufficient_privilege then rejected:=true; end;
 if not rejected then raise exception 'Foreign account was not rejected'; end if;
 perform set_config('request.jwt.claim.sub',f.owner_id::text,true);
 saved:=public.apply_session_command(f.session_id,f.completion_id,1,jsonb_build_object('kind','end','period',1,'recorded_at','2026-10-14T16:01:00Z'));
 if saved->>'tracker_status'<>'completed' then raise exception 'Completion failed'; end if;
 if (select count(*) from public.session_commands where session_id=f.session_id)<>2 then raise exception 'Ledger count mismatch'; end if;
end
$verify$;
select 'PASS: generated-owner profile, save, retry, foreign-read/write denial, completion. All fixture rows rolled back.' as verification;
rollback;
