export const MAX_CLIP_BYTES=100*1024*1024;
export const MAX_ACCOUNT_VIDEO_BYTES=250*1024*1024;
const ALLOWED_TYPES=new Set(['video/mp4','video/webm','video/quicktime']);
export function clipKey(accountId,sessionId) {
  if(!accountId||!sessionId)throw new Error('A signed-in account and saved session are required.');
  return JSON.stringify([accountId,sessionId]);
}
export function validateClip(blob) {
  if(!(blob instanceof Blob)||!ALLOWED_TYPES.has(blob.type))throw new Error('Choose an MP4, WebM or MOV video.');
  if(blob.size<1||blob.size>MAX_CLIP_BYTES)throw new Error('Choose a clip smaller than 100 MB. Keep the original full game video elsewhere.');
}
// Device-only storage, not cloud storage or encryption. Account scope prevents
// accidental cross-account display in the app, not access by a device administrator.
export function createDeviceVideoStore(factory=globalThis.indexedDB) {
  function open() {
    if(!factory)throw new Error('This browser does not support device video storage.');
    return new Promise((resolve,reject)=>{
      const request=factory.open('courtiq-device-media-v1',1);
      request.onupgradeneeded=()=>request.result.createObjectStore('clips',{keyPath:'id'});
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(new Error('Device video storage could not open.'));
      request.onblocked=()=>reject(new Error('Close other CourtIQ tabs and try again.'));
    });
  }
  async function transaction(mode,work) {
    const db=await open();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('clips',mode),store=tx.objectStore('clips');let result,error;
      tx.oncomplete=()=>{db.close();resolve(result);};
      tx.onabort=tx.onerror=()=>{db.close();reject(error || new Error('Device video save failed. Storage may be full or unavailable. Your previous clip was kept.'));};
      work(store,value=>{result=value;},err=>{error=err;tx.abort();});
    });
  }
  return {
    async get(accountId,sessionId) {
      const id=clipKey(accountId,sessionId);
      return transaction('readonly',(store,done,fail)=>{const request=store.get(id);request.onsuccess=()=>{
        const record=request.result;
        if(record&&(record.accountId!==accountId||record.sessionId!==sessionId)){fail(new Error('Clip ownership does not match.'));return;}
        done(record || null);
      };});
    },
    async put(accountId,sessionId,blob) {
      const id=clipKey(accountId,sessionId);validateClip(blob);
      return transaction('readwrite',(store,done,fail)=>{
        const request=store.getAll();request.onsuccess=()=>{
          const used=request.result.filter(row=>row.accountId===accountId&&row.id!==id).reduce((sum,row)=>sum+row.blob.size,0);
          if(used+blob.size>MAX_ACCOUNT_VIDEO_BYTES){fail(new Error('This account reached the 250 MB device clip limit. Download and remove an old clip first.'));return;}
          const record={id,accountId,sessionId,blob,savedAt:new Date().toISOString()};store.put(record);done(record);
        };
      });
    },
    async remove(accountId,sessionId) {
      const id=clipKey(accountId,sessionId);
      return transaction('readwrite',(store,done)=>{store.delete(id);done(true);});
    },
    async clearAccount(accountId) {
      if(!accountId)throw new Error('An account is required for device cleanup.');
      return transaction('readwrite',(store,done)=>{
        const request=store.getAll();request.onsuccess=()=>{for(const row of request.result)if(row.accountId===accountId)store.delete(row.id);done(true);};
      });
    },
  };
}
