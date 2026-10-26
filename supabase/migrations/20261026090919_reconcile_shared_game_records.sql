-- Reconcile two completed recordings of the same game into one authoritative
-- shared-player record, preserving a complete reversible audit.
-- Requires 20261025013734_family_shared_player_ledger.sql.
begin;

create table public.shared_game_fusions (
  id uuid primary key default gen_random_uuid(),
  canonical_session_id uuid not null references public.sessions(id) on delete restrict,
  source_session_id uuid not null references public.sessions(id) on delete restrict,
  approved_by uuid references auth.users(id) on delete set null,
  field_sources jsonb not null,
  shooting_source text not null check (shooting_source in ('canonical','source')),
  canonical_before_stats jsonb not null,
  canonical_before_shots jsonb not null,
  canonical_after_version integer not null,
  created_at timestamptz not null default now(),
  reversed_at timestamptz,
  constraint distinct_fused_games check(canonical_session_id<>source_session_id)
);
create unique index shared_game_fusions_active_canonical on public.shared_game_fusions(canonical_session_id)
  where reversed_at is null;
create unique index shared_game_fusions_active_source on public.shared_game_fusions(source_session_id)
  where reversed_at is null;
alter table public.shared_game_fusions enable row level security;
revoke all on public.shared_game_fusions from public,anon,authenticated;
grant select on public.shared_game_fusions to authenticated;
create policy shared_game_fusions_read on public.shared_game_fusions for select to authenticated
using (
  exists(select 1 from public.sessions t
    where t.id=canonical_session_id and private.can_read_player(t.player_id))
  and exists(select 1 from public.sessions s
    where s.id=source_session_id and private.can_read_player(s.player_id))
);

create or replace function public.fuse_shared_game(
 p_canonical uuid,p_source uuid,p_fields jsonb,p_shooting text
) returns uuid language plpgsql security definer set search_path='' as $$
declare
 canonical public.sessions%rowtype;
 source public.sessions%rowtype;
 new_stats jsonb;
 old_stats jsonb;
 old_shots jsonb;
 field_item record;
 selected text;
 stat_key text;
 audit_id uuid;
begin
 if auth.uid() is null then raise exception 'Sign in before combining games' using errcode='42501'; end if;
 if p_canonical is null or p_source is null or p_canonical=p_source then
   raise exception 'Choose two different saved games' using errcode='22023'; end if;
 if p_fields is null or jsonb_typeof(p_fields)<>'object'
   or p_shooting not in ('canonical','source') or p_shooting is null then
   raise exception 'Explicit stat and shooting selections are required' using errcode='22023'; end if;
 for field_item in select * from jsonb_each_text(p_fields) loop
   if field_item.key not in ('ast','reb','stl','blk','to','pf','min')
     or field_item.value not in ('canonical','source') then
     raise exception 'Unsupported stat selection' using errcode='22023'; end if;
 end loop;
 -- Lock in a stable order across concurrent reconciliation attempts.
 perform 1 from public.sessions where id in(p_canonical,p_source) order by id for update;
 select * into canonical from public.sessions where id=p_canonical;
 select * into source from public.sessions where id=p_source;
 if canonical.id is null or source.id is null or
   canonical.type<>'game' or source.type<>'game'
   or canonical.mode is distinct from 'individual'
   or source.mode is distinct from 'individual'
   or canonical.tracker_status not in ('completed','legacy')
   or source.tracker_status not in ('completed','legacy') then
   raise exception 'Only two saved, completed individual games can be fused' using errcode='22023'; end if;
 if canonical.date is distinct from source.date then
   raise exception 'Game dates do not match' using errcode='22023'; end if;
 if nullif(lower(trim(coalesce(canonical.tracker_context->>'opponent',''))),'') is not null
   and nullif(lower(trim(coalesce(source.tracker_context->>'opponent',''))),'') is not null
   and lower(trim(canonical.tracker_context->>'opponent'))<>lower(trim(source.tracker_context->>'opponent')) then
     raise exception 'Game opponents do not match' using errcode='22023'; end if;
 if not private.can_edit_player(canonical.player_id)
   or not private.is_player_owner(source.player_id)
   or private.is_player_owner(canonical.player_id)
   or canonical.player_id=source.player_id then
   raise exception 'You must own the original record and be an invited editor of the shared player' using errcode='42501'; end if;
 if exists (select 1 from public.shared_game_fusions f where f.reversed_at is null
   and (f.canonical_session_id in(p_canonical,p_source) or f.source_session_id in(p_canonical,p_source))) then
   raise exception 'One of these game records is already fused' using errcode='23505'; end if;
 if exists (select 1 from public.shared_game_transfers where session_id in(p_canonical,p_source)) then
   raise exception 'Previously transferred game cannot be fused' using errcode='22023'; end if;
 select coalesce(jsonb_agg(to_jsonb(l) order by l.created_at,l.id),'[]'::jsonb) into old_shots
   from public.shot_logs l where l.session_id=p_canonical;
 old_stats:=coalesce(canonical.game_stats,'{}'::jsonb);
 new_stats:=old_stats;
 for field_item in select * from jsonb_each_text(p_fields) loop
   if field_item.value='source' then
     stat_key:=field_item.key;
     if source.game_stats ? stat_key then
       new_stats:=jsonb_set(new_stats,array[stat_key],source.game_stats->stat_key,true);
     else
       new_stats:=new_stats-stat_key;
     end if;
     if stat_key='reb' then
       foreach stat_key in array array['oreb','dreb'] loop
         if source.game_stats ? stat_key then
           new_stats:=jsonb_set(new_stats,array[stat_key],source.game_stats->stat_key,true);
         else new_stats:=new_stats-stat_key; end if;
       end loop;
     end if;
   end if;
 end loop;
 if p_shooting='source' then
   -- Summary FT values only apply if the selected shot ledger contains no FT
   -- attempts. Carry the matching source summary rather than mixing authors.
   foreach stat_key in array array['ft_total','ft_made'] loop
     if source.game_stats ? stat_key then
       new_stats:=jsonb_set(new_stats,array[stat_key],source.game_stats->stat_key,true);
     else new_stats:=new_stats-stat_key; end if;
   end loop;
   delete from public.shot_logs where session_id=p_canonical;
   insert into public.shot_logs(session_id,player_id,zone_id,made,created_at)
   select p_canonical,canonical.player_id,l.zone_id,l.made,l.created_at
     from public.shot_logs l where l.session_id=p_source order by l.created_at,l.id;
 end if;
 perform set_config('courtiq.command_write','on',true);
 update public.sessions set game_stats=new_stats,
    tracker_version=tracker_version+1
    where id=p_canonical returning * into canonical;
 perform set_config('courtiq.command_write','off',true);
 insert into public.shared_game_fusions(
  canonical_session_id,source_session_id,approved_by,field_sources,
  shooting_source,canonical_before_stats,canonical_before_shots,
  canonical_after_version)
 values(p_canonical,p_source,auth.uid(),p_fields,p_shooting,
  old_stats,old_shots,canonical.tracker_version)
 returning id into audit_id;
 return audit_id;
end $$;
revoke all on function public.fuse_shared_game(uuid,uuid,jsonb,text) from public,anon;
grant execute on function public.fuse_shared_game(uuid,uuid,jsonb,text) to authenticated;

create or replace function public.undo_shared_game_fusion(p_fusion uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare
 f public.shared_game_fusions%rowtype;
 canonical public.sessions%rowtype;
 source public.sessions%rowtype;
 item jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select * into f from public.shared_game_fusions where id=p_fusion for update;
 if not found or f.reversed_at is not null then
   raise exception 'Fusion does not exist or has already been reversed' using errcode='22023'; end if;
 perform 1 from public.sessions where id in(f.canonical_session_id,f.source_session_id) order by id for update;
 select * into canonical from public.sessions where id=f.canonical_session_id;
 select * into source from public.sessions where id=f.source_session_id;
 if canonical.id is null or source.id is null
  or not private.can_edit_player(canonical.player_id)
  or not private.is_player_owner(source.player_id)
  or canonical.tracker_version<>f.canonical_after_version then
   raise exception 'Not authorized or this game has changed since fusion' using errcode='42501'; end if;
 delete from public.shot_logs where session_id=f.canonical_session_id;
 for item in select * from jsonb_array_elements(f.canonical_before_shots) loop
   insert into public.shot_logs(id,session_id,player_id,zone_id,made,created_at)
   values((item->>'id')::uuid, f.canonical_session_id, canonical.player_id,
    item->>'zone_id',(item->>'made')::boolean,(item->>'created_at')::timestamptz);
 end loop;
 perform set_config('courtiq.command_write','on',true);
 update public.sessions set game_stats=f.canonical_before_stats,tracker_version=tracker_version+1
  where id=f.canonical_session_id;
 perform set_config('courtiq.command_write','off',true);
 update public.shared_game_fusions set reversed_at=now() where id=p_fusion;
 return true;
end $$;
revoke all on function public.undo_shared_game_fusion(uuid) from public,anon;
grant execute on function public.undo_shared_game_fusion(uuid) to authenticated;
commit;