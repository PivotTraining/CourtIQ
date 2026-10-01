import 'server-only';
import { billingIdentity, readBilling } from './billingRuntime';
import { BillingError } from './billingPolicy.mjs';
import { readAll } from './dataSafety.mjs';

export async function premiumIdentity() {
  if (process.env.COURTIQ_PREMIUM_ANALYTICS_ENABLED !== 'true') throw new BillingError('Premium analytics are not activated yet.', 503);
  const identity = await billingIdentity(), state = await readBilling(identity.client);
  if (!['legacy','trial','player','coach'].includes(state.access)) throw new BillingError('Start an eligible trial or choose a membership for premium analytics.', 403);
  return { ...identity, access: state.access };
}
export async function premiumDataset({ client, user, access }) {
  // Use the verified user's RLS-scoped client, never a service-role client or a supplied owner id.
  const profiles = await readAll(() => {
    let query = client.from('players').select('id,name,position,firebase_uid').eq('manager_uid', user.id).order('id');
    if (access === 'player') query = query.eq('firebase_uid', user.id);
    return query;
  });
  const players = profiles.map(({ id, name, position }) => ({ id, name, position }));
  if (!players.length) return { players, sessions: [], community: { status: 'not_activated' } };
  const ids = players.map(player => player.id);
  const [sessions, shots] = await Promise.all([
    readAll(() => client.from('sessions').select('id,player_id,date,type,game_stats,tracker_status,coverage_confirmed').in('player_id', ids).eq('type','game').eq('tracker_status','completed').order('date').order('id')),
    readAll(() => client.from('shot_logs').select('id,session_id,player_id,zone_id,made').in('player_id', ids).order('id')),
  ]);
  const grouped = new Map();
  for (const shot of shots) {
    const key = `${shot.player_id}:${shot.session_id}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push({ id: shot.id, zone_id: shot.zone_id, made: shot.made });
  }
  return { players, sessions: sessions.map(session => ({ ...session, shot_logs: grouped.get(`${session.player_id}:${session.id}`) || [] })), community: { status: 'not_activated' } };
}
