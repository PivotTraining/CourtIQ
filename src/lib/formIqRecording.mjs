// CourtIQ local-only, silent, annotated camera recording.
// Never creates media without an explicit user action. Never uploads video.
export const FORM_IQ_RECORD_LIMIT = 100 * 1024 * 1024;
export const FORM_IQ_RECORD_MAX_MS = 4 * 60 * 1000;
const TYPES = [
  'video/mp4;codecs="avc1.42E01E"',
  'video/mp4',
  'video/webm;codecs=vp8',
  'video/webm',
];
export function supportedRecordingType(MediaRecorderCtor) {
  if (!MediaRecorderCtor || typeof MediaRecorderCtor.isTypeSupported !== 'function') return null;
  return TYPES.find(type => MediaRecorderCtor.isTypeSupported(type)) || null;
}
export function cleanRecordingType(type) {
  const base = String(type||'').toLowerCase().split(';')[0].trim();
  return ['video/mp4','video/webm'].includes(base) ? base : null;
}
export function createRecordingCollector(limit=FORM_IQ_RECORD_LIMIT) {
  let chunks=[],size=0,overflow=false;
  return {
    push(blob) {
      if (overflow || !(blob instanceof Blob) || blob.size<1) return !overflow;
      if (blob.size+size>limit) {overflow=true;return false;}
      size+=blob.size;chunks.push(blob);return true;
    },
    finish(type) {
      if(overflow)throw new Error('Recording exceeded the 100 MB limit. Use a shorter clip.');
      const mime=cleanRecordingType(type);
      if(!mime||size===0)throw new Error('Browser did not produce a playable MP4/WebM recording.');
      return new Blob(chunks,{type:mime});
    },
    get size(){return size;},
    get overflow(){return overflow;},
  };
}
export function recordingFileExtension(type){return cleanRecordingType(type)==='video/mp4'?'mp4':'webm';}
