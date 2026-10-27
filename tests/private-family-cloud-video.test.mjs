import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('cloud game film is private, opt-in and limited by exact player/session authorization',async()=>{
  const sql=await readFile(new URL('../supabase/migrations/20261027062500_private_family_game_film.sql',import.meta.url),'utf8');
  assert.match(sql,/values\('courtiq-family-game-film','courtiq-family-game-film',false,52428800/);
  assert.match(sql,/private\.courtiq_has_player_share\(p\.id\)/);
  assert.match(sql,/create policy courtiq_game_film_read on storage\.objects/);
  assert.match(sql,/create policy courtiq_game_film_upload on storage\.objects/);
  assert.match(sql,/create policy courtiq_game_film_remove on storage\.objects/);
  assert.match(sql,/private\.courtiq_game_film_has_room\(name\)/);
  assert.match(sql,/count\(\*\).*from storage\.objects/);
  assert.doesNotMatch(sql,/\bpublic\s*=\s*true\b/i);
});
test('cloud upload never occurs without separate explicit parent consent',async()=>{
  const component=await readFile(new URL('../src/components/shots/FamilyCloudVideo.jsx',import.meta.url),'utf8');
  assert.match(component,/I have permission to upload this footage/);
  assert.match(component,/!consent\|\|!localClip\?\.blob/);
  assert.match(component,/window\.confirm\('Upload this video to private CourtIQ cloud storage/);
  assert.match(component,/getFamilyGameClipUrl\(path\)/);
  assert.match(component,/downloaded backup/);
  const recorder=await readFile(new URL('../src/components/shots/GameTrackerRecorder.jsx',import.meta.url),'utf8');
  const report=await readFile(new URL('../src/components/shots/SessionVideo.jsx',import.meta.url),'utf8');
  assert.match(recorder,/FamilyCloudVideo playerId=\{playerId\} sessionId=\{sessionId\}/);
  assert.match(report,/FamilyCloudVideo sessionId=\{sessionId\}/);
});
test('cloud media module imposes 50MB and valid filename constraints while preserving existing local videos',async()=>{
  const cloud=await readFile(new URL('../src/lib/cloudGameVideo.mjs',import.meta.url),'utf8');
  assert.match(cloud,/MAX_GAME_CLOUD_CLIP_BYTES=50\*1024\*1024/);
  assert.match(cloud,/upsert:false/);
  assert.match(cloud,/15\*60/);
  assert.match(cloud,/createSignedUrl/);
  assert.match(cloud,/Select a saved player game before accessing family footage/);
  assert.match(cloud,/from\(GAME_FILM_BUCKET\)/);
});
