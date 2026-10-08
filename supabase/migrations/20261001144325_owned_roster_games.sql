begin;
do $$ begin
  if to_regclass('public.session_commands') is null then raise exception 'Apply ownership and recovery migrations first'; end if;
end $$;

create table public.team_games (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  team_name text not null check (char_length(team_name) between 1 and 100),
  context jsonb not null,
  create_request jsonb not null,
  status text not null default 'active' check (status in ('active','completed')),
  finish_id uuid,
  finish_request jsonb,
  created_at timestamptz not null default now()
);
create index team_games_owner_created on public.team_games(owner_id,created_at,id);
create table public.team_game_players (
  game_id uuid not null references public.team_games(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  session_id uuid not null unique references public.sessions(id) on delete cascade,
  primary key(game_id,player_id)
);
create index team_game_players_player on public.team_game_players(player_id);
alter table public.team_games enable row level security;
alter table public.team_game_players enable row level security;
revoke all on public.team_games,public.team_game_players from public,anon,authenticated;
grant select on public.team_games,public.team_game_players to authenticated;
create policy team_games_owned on public.team_games for select to authenticated using (owner_id=(select auth.uid()));
create policy team_game_players_owned on public.team_game_players for select to authenticated
using (exists(select 1 from public.team_games g where g.id=game_id and g.owner_id=(select auth.uid())));

-- Keep privileged implementations out of exposed schemas. Public wrappers are
-- invoker functions; neither tables nor helpers accept anonymous browser writes.
create function private.create_owned_team_game(p_id uuid,p_name text,p_context jsonb,p_players uuid[])
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); g public.team_games; ids uuid[]; pid uuid; sid uuid; request jsonb; game_date date;
begin
  if uid is null or not exists(select 1 from auth.users where id=uid) then raise exception 'Sign in required'; end if;
  if p_id is null or p_name is null or char_length(trim(p_name)) not between 1 and 100
    or jsonb_typeof(p_context) is distinct from 'object' or octet_length(p_context::text)>4096
    or cardinality(p_players) is null or cardinality(p_players) not between 1 and 30
    or array_position(p_players,null) is not null then raise exception 'Invalid game or roster'; end if;
  select array_agg(distinct id order by id) into ids from unnest(p_players) id;
  if cardinality(ids)<>cardinality(p_players) then raise exception 'Duplicate roster player'; end if;
  game_date:=(p_context->>'date')::date;
  if game_date is null then raise exception 'Game date required'; end if;
  request:=jsonb_build_object('team_name',trim(p_name),'context',p_context,'players',to_jsonb(ids));
  -- Serialize retries for the same game ID before checking/inserting.
  perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
  select * into g from public.team_games where id=p_id;
  if found then
    if g.owner_id<>uid or g.create_request<>request then raise exception 'Game ID unavailable or reused'; end if;
    return to_jsonb(g);
  end if;
  -- Lock all roster identities in deterministic order, blocking deletion/transfer.
  perform 1 from public.players where id=any(ids) and owner_id=uid order by id for share;
  if (select count(*) from public.players where id=any(ids) and owner_id=uid)<>cardinality(ids) then
    raise exception 'Roster contains an unavailable player'; end if;
  insert into public.team_games(id,owner_id,team_name,context,create_request) values(p_id,uid,trim(p_name),p_context,request) returning * into g;
  foreach pid in array ids loop
    insert into public.sessions(player_id,type,mode,date,tracker_status,tracker_context)
      values(pid,'game','team',game_date,'active',p_context) returning id into sid;
    insert into public.team_game_players values(p_id,pid,sid);
  end loop;
  return to_jsonb(g);
end $$;

create function private.finish_owned_team_game(p_game uuid,p_id uuid,p_versions jsonb,p_team_score integer,p_opponent_score integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); g public.team_games; link record; request jsonb; final_context jsonb; s public.sessions;
begin
  if uid is null or not exists(select 1 from auth.users where id=uid) then raise exception 'Sign in required'; end if;
  if p_id is null or jsonb_typeof(p_versions) is distinct from 'object'
    or octet_length(p_versions::text)>4096 then raise exception 'Invalid completion'; end if;
  if (p_team_score is null)<>(p_opponent_score is null)
    or p_team_score not between 0 and 999 or p_opponent_score not between 0 and 999 then raise exception 'Both scores or neither required'; end if;
  request:=jsonb_build_object('versions',p_versions,'team_score',p_team_score,'opponent_score',p_opponent_score);
  select * into g from public.team_games where id=p_game and owner_id=uid for update;
  if not found then raise exception 'Game unavailable'; end if;
  if g.status='completed' then
    if g.finish_id=p_id and g.finish_request=request then return to_jsonb(g); end if;
    raise exception 'Game already completed';
  end if;
  if (select count(*) from public.team_game_players where game_id=p_game)<>jsonb_array_length(g.create_request->'players')
    or (select count(*) from jsonb_object_keys(p_versions))<>jsonb_array_length(g.create_request->'players') then
    raise exception 'Roster changed; review missing records before completion'; end if;
  -- Every expected version must match before ANY session is ended.
  for link in select * from public.team_game_players where game_id=p_game order by session_id loop
    select * into s from public.sessions where id=link.session_id for update;
    if not found or s.player_id<>link.player_id or not exists(select 1 from public.players where id=link.player_id and owner_id=uid)
      or s.tracker_status<>'active' or not (p_versions ? link.session_id::text)
      or (p_versions->>link.session_id::text)::integer is distinct from s.tracker_version then
      raise exception using errcode='40001',message='SESSION_CONFLICT: roster game changed; reload before finishing'; end if;
  end loop;
  final_context:=g.context||jsonb_build_object('team_score',p_team_score,'opponent_score',p_opponent_score);
  for link in select * from public.team_game_players where game_id=p_game order by session_id loop
    perform public.apply_session_command(link.session_id,gen_random_uuid(),(p_versions->>link.session_id::text)::integer,
      jsonb_build_object('kind','context','context',final_context,'period',1,'clock','00:00','recorded_at',now()));
    perform public.apply_session_command(link.session_id,gen_random_uuid(),(p_versions->>link.session_id::text)::integer+1,
      jsonb_build_object('kind','end','period',1,'clock','00:00','recorded_at',now()));
  end loop;
  update public.team_games set status='completed',context=final_context,finish_id=p_id,finish_request=request where id=p_game returning * into g;
  return to_jsonb(g);
end $$;

revoke all on function private.create_owned_team_game(uuid,text,jsonb,uuid[]),private.finish_owned_team_game(uuid,uuid,jsonb,integer,integer) from public,anon;
grant execute on function private.create_owned_team_game(uuid,text,jsonb,uuid[]),private.finish_owned_team_game(uuid,uuid,jsonb,integer,integer) to authenticated;
create function public.create_owned_team_game(p_id uuid,p_name text,p_context jsonb,p_players uuid[])
returns jsonb language sql security invoker set search_path='' as $$ select private.create_owned_team_game(p_id,p_name,p_context,p_players) $$;
create function public.finish_owned_team_game(p_game uuid,p_id uuid,p_versions jsonb,p_team_score integer,p_opponent_score integer)
returns jsonb language sql security invoker set search_path='' as $$ select private.finish_owned_team_game(p_game,p_id,p_versions,p_team_score,p_opponent_score) $$;
revoke all on function public.create_owned_team_game(uuid,text,jsonb,uuid[]),public.finish_owned_team_game(uuid,uuid,jsonb,integer,integer) from public,anon;
grant execute on function public.create_owned_team_game(uuid,text,jsonb,uuid[]),public.finish_owned_team_game(uuid,uuid,jsonb,integer,integer) to authenticated;
commit;
