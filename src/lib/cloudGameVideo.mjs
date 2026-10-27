import {getSupabase} from './supabase';
import {validateClip} from './deviceVideo.mjs';

export const GAME_FILM_BUCKET='courtiq-family-game-film';
export const MAX_GAME_CLOUD_CLIP_BYTES=50*1024*1024;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function folder(playerId,sessionId) {
  if(!UUID.test(playerId)||!UUID.test(sessionId))throw new Error('Select a saved player game before accessing family footage.');
  return playerId+'/'+sessionId;
}
function ext(blob){
  if(blob.type==='video/mp4')return 'mp4';
  if(blob.type==='video/webm')return 'webm';
  if(blob.type==='video/quicktime')return 'mov';
  throw new Error('Only compatible MP4, WebM and MOV video can be uploaded.');
}
function requireResult(response,label){
  if(response.error)throw new Error(label+': '+(response.error.message||'Please try again.'));
  return response.data;
}

export async function uploadFamilyGameClip({playerId,sessionId,blob}) {
  validateClip(blob);
  if(blob.size>MAX_GAME_CLOUD_CLIP_BYTES)throw new Error('Cloud clips are limited to 50 MB. Download this larger clip locally or compress it first.');
  const prefix=folder(playerId,sessionId);
  const path=prefix+'/'+crypto.randomUUID()+'.'+ext(blob);
  requireResult(await getSupabase().storage.from(GAME_FILM_BUCKET).upload(path,blob,{
    contentType:blob.type,upsert:false,cacheControl:'3600',
  }),'Cloud video backup failed');
  return path;
}
export async function listFamilyGameClips({playerId,sessionId}) {
  const prefix=folder(playerId,sessionId);
  const files=requireResult(await getSupabase().storage.from(GAME_FILM_BUCKET).list(prefix,{
    limit:100,sortBy:{column:'created_at',order:'asc'}
  }),'Could not list shared game footage')||[];
  return files.filter(file=>UUID.test(file.name.slice(0,36))&&
      /\.(mp4|webm|mov)$/.test(file.name))
    .map(file=>({...file,path:prefix+'/'+file.name}));
}
export async function getFamilyGameClipUrl(path) {
  if(typeof path!=='string'||!/^([0-9a-f-]{36}\/){2}[0-9a-f-]{36}\.(mp4|webm|mov)$/i.test(path))
    throw new Error('Choose a video from a saved player game.');
  const record=requireResult(await getSupabase().storage.from(GAME_FILM_BUCKET)
    .createSignedUrl(path,15*60),'Could not open family clip');
  if(!record?.signedUrl)throw new Error('Cloud playback URL unavailable.');
  return record.signedUrl;
}
export async function removeFamilyGameClip(path) {
  if(typeof path!=='string'||!/^([0-9a-f-]{36}\/){2}[0-9a-f-]{36}\.(mp4|webm|mov)$/i.test(path))
    throw new Error('Choose a video from a saved player game.');
  requireResult(await getSupabase().storage.from(GAME_FILM_BUCKET).remove([path]),
    'Could not remove the cloud clip');
}
