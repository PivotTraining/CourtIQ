export const FREE_STARTER = Object.freeze({ savedGames: 0, trainingSessions: 1, journalEntries: 0, advancedAnalytics: false });
export function starterState(value) {
  if (!value || !['legacy', 'free', 'full'].includes(value.mode) || !['available', 'used', 'unavailable'].includes(value.workout))
    throw new Error('Your access could not be verified. Please retry.');
  if (value.mode === 'free' && value.billing?.access !== 'read_only') throw new Error('Inconsistent account access.');
  return value;
}
export const INTRO_DRILLS = Object.freeze([
  { id: 'starter-form', name: 'Find your touch', reps: 10, description: 'Ten close-range form shots. Stay balanced and hold your follow-through.' },
  { id: 'starter-finishing', name: 'Finish both sides', reps: 10, description: 'Five controlled layups per side. Prioritize footwork and a soft finish.' },
  { id: 'starter-ft', name: 'Own your routine', reps: 10, description: 'Ten free throws. Use the same breath, dribbles and release each time.' },
]);
