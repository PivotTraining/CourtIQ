// Reapply this device's known, unsynced stat events to a fresh, RLS-checked
// server session snapshot. This does NOT share player permissions across accounts.
// The operator must confirm that two devices did not record the same real event.
export function rebasePendingGame({local,remote,projectCommand}) {
  if(!local?.snapshot?.session?.id||!remote?.session?.id||
    local.snapshot.session.id!==remote.session.id)
    throw new Error('Remote session does not match this device game.');
  if(remote.session.tracker_status!=='active')
    throw new Error('The server game has already ended. Export pending events before resolving.');
  const saved=new Set((remote.events||[]).map(event=>event.id));
  let snapshot=remote;const pending=[];
  for(const command of local.pending||[]){
    if(command.sessionId!==remote.session.id)throw new Error('A queued entry belongs to another game.');
    if(saved.has(command.id))continue; // An earlier RPC may have succeeded before a network error.
    const rebased={...command,version:snapshot.session.tracker_version};
    snapshot=projectCommand(snapshot,rebased); // Reject invalid undos, negative totals, etc.
    pending.push(rebased);
  }
  return {...local,snapshot,pending};
}
