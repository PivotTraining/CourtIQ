-- Additive, prepared only. Apply AFTER web_player_ownership_safeguards and a
-- verified backup/restore. Existing sessions remain legacy, never auto-resumed.
begin;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'players_owner_auth_fk') then
    raise exception 'Apply and verify ownership safeguards first';
  end if;
end $$;

alter table public.sessions add column tracker_version integer not null default 0 check (tracker_version >= 0);
alter table public.sessions add column tracker_status text not null default 'legacy' check (tracker_status in ('legacy','active','completed'));
alter table public.sessions add column tracker_context jsonb not null default '{}'::jsonb;
create index sessions_active_player_idx on public.sessions(player_id, created_at desc, id) where tracker_status = 'active';

create table public.session_commands (
  id uuid primary key,
  session_id uuid not null references public.sessions(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  version integer not null check (version > 0),
  payload jsonb not null,
  reverses uuid references public.session_commands(id),
  created_at timestamptz not null default now(),
  unique(session_id, version), unique(reverses)
);
create index session_commands_actor_idx on public.session_commands(actor_id);
alter table public.session_commands enable row level security;
revoke all on public.session_commands from public, anon, authenticated;
grant select on public.session_commands to authenticated;
create policy commands_owned_read on public.session_commands for select to authenticated
  using (exists (select 1 from public.sessions s where s.id = session_id and private.owns_player(s.player_id)));

-- Only this transaction may update tracked totals/status. Older clients cannot
-- overwrite a recovered game with an unversioned end-of-game snapshot.
create function private.guard_tracked_session() returns trigger language plpgsql set search_path = '' as $$
begin
  if old.tracker_status <> 'legacy' and current_setting('courtiq.command_write', true) is distinct from 'on' then
    raise exception 'Use the versioned tracker to update this session';
  end if;
  return new;
end $$;
revoke all on function private.guard_tracked_session() from public, anon, authenticated;
create trigger guard_tracked_session before update on public.sessions for each row execute function private.guard_tracked_session();

-- Restrictive policies also prevent older clients from bypassing the ledger.
-- Foreign-key cleanup remains atomic and is not implemented in the browser.
create policy shots_tracked_insert_guard on public.shot_logs as restrictive for insert to authenticated
  with check (exists (select 1 from public.sessions where id=session_id and tracker_status='legacy'));
create policy shots_tracked_delete_guard on public.shot_logs as restrictive for delete to authenticated
  using (exists (select 1 from public.sessions where id=session_id and tracker_status='legacy'));

-- SECURITY DEFINER is needed only for the append-only ledger and shot correction.
-- Every invocation explicitly verifies real Auth ownership BEFORE any mutation.
create function public.apply_session_command(p_session uuid, p_id uuid, p_version integer, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  s public.sessions%rowtype; previous public.session_commands%rowtype; target public.session_commands%rowtype;
  kind text; stat text; delta integer; value numeric; g jsonb; reverse_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select * into s from public.sessions where id=p_session for update;
  if not found or not exists (select 1 from public.players where id=s.player_id and owner_id=auth.uid()) then
    raise exception 'Session unavailable' using errcode='42501';
  end if;
  if p_id is null or p_version is null or p_payload is null or jsonb_typeof(p_payload) <> 'object' then raise exception 'Invalid command'; end if;
  select * into previous from public.session_commands where id=p_id;
  if found then
    if previous.session_id <> p_session or previous.actor_id <> auth.uid() or previous.payload <> p_payload then
      raise exception 'Idempotency key reused for a different entry';
    end if;
    return to_jsonb(s); -- retry after a lost response: no duplicate mutation
  end if;
  if s.tracker_status <> 'active' then raise exception 'Session is not active'; end if;
  if s.tracker_version <> p_version then raise exception 'SESSION_CONFLICT: another device changed this session' using errcode='40001'; end if;
  if octet_length(p_payload::text) > 4096 then raise exception 'Entry too large'; end if;
  if coalesce(p_payload->>'period','1') !~ '^[1-9][0-9]?$' then raise exception 'Invalid period'; end if;
  if p_payload ? 'clock' and (p_payload->>'clock') !~ '^[0-9]{1,2}:[0-5][0-9]$' then raise exception 'Invalid game clock'; end if;
  if not (p_payload ? 'recorded_at') then raise exception 'Entry timestamp required'; end if;
  perform (p_payload->>'recorded_at')::timestamptz;
  kind := p_payload->>'kind'; g := coalesce(s.game_stats, '{}'::jsonb);
  if kind='stat' then
    stat := p_payload->>'key'; delta := (p_payload->>'delta')::integer;
    if stat is null or stat <> all(array['ast','reb','stl','blk','to','pf','min','oreb','dreb']) or delta is null or delta not in (-1,1) then raise exception 'Invalid stat'; end if;
    value := coalesce((g->>stat)::numeric,0) + delta;
    if value < 0 or value > 10000 then raise exception 'Invalid stat total'; end if;
    if stat='reb' and value < coalesce((g->>'oreb')::numeric,0)+coalesce((g->>'dreb')::numeric,0) then raise exception 'Total rebounds cannot be below the recorded split'; end if;
    g := jsonb_set(g,array[stat],to_jsonb(value));
    if stat in ('oreb','dreb') then g := jsonb_set(g,array['reb'],to_jsonb(coalesce((g->>'reb')::numeric,0)+delta)); end if;
  elsif kind='shot' then
    if coalesce(p_payload->>'zone_id','') <> all(array['left-corner-3','left-wing-3','top-key-3','right-wing-3','right-corner-3','left-elbow','right-elbow','free-throw','left-block','right-block','paint','left-mid','right-mid']) then raise exception 'Invalid shot zone'; end if;
    if jsonb_typeof(p_payload->'made') is distinct from 'boolean' then raise exception 'Shot result required'; end if;
    insert into public.shot_logs(id,session_id,player_id,zone_id,made,created_at)
      values(p_id,p_session,s.player_id,p_payload->>'zone_id',(p_payload->>'made')::boolean,(p_payload->>'recorded_at')::timestamptz);
  elsif kind='reverse' then
    reverse_id := (p_payload->>'target')::uuid;
    select * into target from public.session_commands where id=reverse_id and session_id=p_session;
    if not found or exists (select 1 from public.session_commands where reverses=reverse_id) then raise exception 'Entry cannot be reversed'; end if;
    if target.payload->>'kind'='shot' then
      delete from public.shot_logs where id=target.id and session_id=p_session;
    elsif target.payload->>'kind'='stat' then
      stat := target.payload->>'key'; delta := (target.payload->>'delta')::integer;
      value := coalesce((g->>stat)::numeric,0)-delta;
      if value < 0 then raise exception 'Reversal would make the total negative'; end if;
      if stat='reb' and value < coalesce((g->>'oreb')::numeric,0)+coalesce((g->>'dreb')::numeric,0) then raise exception 'Reverse the split rebound entry instead'; end if;
      g := jsonb_set(g,array[stat],to_jsonb(value));
      if stat in ('oreb','dreb') then g := jsonb_set(g,array['reb'],to_jsonb(coalesce((g->>'reb')::numeric,0)-delta)); end if;
    else raise exception 'Only shot and stat entries can be reversed'; end if;
  elsif kind='context' then
    if jsonb_typeof(p_payload->'context') is distinct from 'object' then raise exception 'Context required'; end if;
    s.tracker_context := p_payload->'context';
    s.date := coalesce(nullif(s.tracker_context->>'date','')::date,s.date);
  elsif kind='end' then s.tracker_status := 'completed';
  else raise exception 'Unknown entry type'; end if;
  perform set_config('courtiq.command_write','on',true);
  update public.sessions set game_stats=g, tracker_context=s.tracker_context, date=s.date,
    tracker_status=s.tracker_status, tracker_version=tracker_version+1 where id=p_session returning * into s;
  perform set_config('courtiq.command_write','off',true);
  insert into public.session_commands(id,session_id,actor_id,version,payload,reverses)
    values(p_id,p_session,auth.uid(),s.tracker_version,p_payload,reverse_id);
  return to_jsonb(s);
end $$;
revoke all on function public.apply_session_command(uuid,uuid,integer,jsonb) from public, anon;
grant execute on function public.apply_session_command(uuid,uuid,integer,jsonb) to authenticated;

create table public.workout_results (
  id uuid primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  completed_at timestamptz not null default now(),
  elapsed_seconds integer not null check (elapsed_seconds between 0 and 86400),
  drills jsonb not null check (jsonb_typeof(drills)='array' and jsonb_array_length(drills) between 1 and 100)
);
create index workout_results_player_time_idx on public.workout_results(player_id,completed_at desc,id);
alter table public.workout_results enable row level security;
revoke all on public.workout_results from public, anon, authenticated;
grant select, insert on public.workout_results to authenticated;
create policy workouts_owned_read on public.workout_results for select to authenticated using (private.owns_player(player_id));
create policy workouts_owned_insert on public.workout_results for insert to authenticated with check (private.owns_player(player_id));
commit;
