-- Deliberate, private parental cloud backup for bounded game clips.
-- No automatic uploads. A parent must explicitly choose a clip to back up.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('courtiq-family-game-film','courtiq-family-game-film',false,52428800,
  array['video/mp4','video/webm','video/quicktime']::text[])
on conflict (id) do nothing;

create or replace function private.courtiq_may_access_game_film(p_name text)
returns boolean language sql stable security definer set search_path=''
as $fn$
  select (select auth.uid()) is not null
  and exists (
    select 1 from public.sessions s
      join public.players p on p.id=s.player_id
    where s.type='game'
      and p_name like p.id::text || '/' || s.id::text || '/%'
      and (p.manager_uid=(select auth.uid())::text
         or private.courtiq_has_player_share(p.id))
  );
$fn$;

create or replace function private.courtiq_game_film_has_room(p_name text)
returns boolean language sql stable security definer set search_path=''
as $fn$
  select (
    select count(*) from storage.objects obj
    where obj.bucket_id='courtiq-family-game-film'
      and obj.name like split_part(p_name,'/',1)||'/'||split_part(p_name,'/',2)||'/%'
  ) < 12;
$fn$;
revoke all on function private.courtiq_may_access_game_film(text),
private.courtiq_game_film_has_room(text) from public,anon;
grant execute on function private.courtiq_may_access_game_film(text),
private.courtiq_game_film_has_room(text) to authenticated;

-- Do not allow guest links, public downloads, overwriting other clips, or
-- enumeration outside an authorized game/player folder.
create policy courtiq_game_film_read on storage.objects
for select to authenticated
using(bucket_id='courtiq-family-game-film'
  and private.courtiq_may_access_game_film(name));

create policy courtiq_game_film_upload on storage.objects
for insert to authenticated
with check(bucket_id='courtiq-family-game-film'
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(mp4|webm|mov)$'
  and private.courtiq_may_access_game_film(name)
  and private.courtiq_game_film_has_room(name));

create policy courtiq_game_film_remove on storage.objects
for delete to authenticated
using(bucket_id='courtiq-family-game-film'
  and private.courtiq_may_access_game_film(name)
  and (owner_id=(select auth.uid())::text or exists(
    select 1 from public.sessions s join public.players p on p.id=s.player_id
    where name like p.id::text||'/'||s.id::text||'/%'
      and p.manager_uid=(select auth.uid())::text
  )));
