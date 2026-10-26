// Serial server acknowledgement for locally queued live game events.
// The component can continue appending new commands while an RPC is pending;
// each acknowledgment removes ONLY its own head command from the latest queue.
export async function drainLiveEntries({getCurrent,persist,send,isCurrent}) {
  while(true){
    if(!isCurrent())throw new Error('Account changed. Sync stopped.');
    const head=getCurrent()?.pending?.[0];
    if(!head)return true;
    const accepted=await send(head);
    if(!isCurrent())throw new Error('Account changed. Sync stopped.');
    if(accepted?.tracker_version!==undefined && accepted.tracker_version!==head.version+1){
      const err=new Error('SESSION_CONFLICT: another device changed this game.');err.code='40001';throw err;
    }
    const latest=getCurrent();
    if(latest?.pending?.[0]?.id!==head.id){
      const err=new Error('SESSION_CONFLICT: device queue changed during sync.');err.code='40001';throw err;
    }
    persist({...latest,pending:latest.pending.slice(1)});
  }
}
