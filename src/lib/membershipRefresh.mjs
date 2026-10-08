// UI refresh only. Authenticated server/DB checks remain the access authority.
// Uses durations issued by the server, never a device wall-clock entitlement.
export function membershipRefreshDelay(state) {
  const billing = state?.billing;
  if (state?.mode !== 'full' || billing?.access === 'legacy') return null;
  if (billing?.access === 'trial' && billing.trial?.status === 'active') {
    const seconds = Number(billing.trial.remaining_seconds);
    return Number.isFinite(seconds) && seconds >= 0 ? Math.min(60_000, Math.max(1000, seconds * 1000 + 250)) : 1000;
  }
  if (['player','coach'].includes(billing?.access)) {
    const end = Date.parse(billing.subscription?.period_end), now = Date.parse(billing.server_now);
    return Number.isFinite(end) && Number.isFinite(now) ? Math.min(60_000, Math.max(1000,end-now+250)) : 1000;
  }
  return null;
}

export function createMembershipLoader({ read, accept, reject }) {
  let generation = 0, controller;
  return {
    async refresh() {
      const current = ++generation;
      controller?.abort(); controller = new AbortController();
      const signal = controller.signal;
      try {
        const result = await read(signal);
        if (current !== generation || signal.aborted) return false;
        accept(result); return true;
      } catch(error) {
        if(current !== generation || signal.aborted) return false;
        reject(error); return false;
      }
    },
    dispose() { generation++; controller?.abort(); },
  };
}
