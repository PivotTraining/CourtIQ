-- Follow-up hardening: portable filename suffix pattern and an explicit outer
-- storage.objects reference in the manager-delete authorization subquery.
drop policy if exists courtiq_game_film_upload on storage.objects;
create policy courtiq_game_film_upload on storage.objects
for insert to authenticated
with check(bucket_id='courtiq-family-game-film'
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}[.](mp4|webm|mov)$'
  and private.courtiq_may_access_game_film(name)
  and private.courtiq_game_film_has_room(name));

drop policy if exists courtiq_game_film_remove on storage.objects;
create policy courtiq_game_film_remove on storage.objects
for delete to authenticated
using(bucket_id='courtiq-family-game-film'
  and private.courtiq_may_access_game_film(storage.objects.name)
  and (owner_id=(select auth.uid())::text or exists(
    select 1 from public.sessions s join public.players p on p.id=s.player_id
    where storage.objects.name like p.id::text||'/'||s.id::text||'/%'
      and p.manager_uid=(select auth.uid())::text
  )));
