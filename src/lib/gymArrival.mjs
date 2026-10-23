import { distanceMeters, DEFAULT_GYM_RADIUS_METERS } from './gymGeofence.mjs';

export const GYM_COOLDOWN_MS = 6 * 60 * 60 * 1000;
export const GYM_EXIT_BUFFER_METERS = 100;
export const gymPreferenceKey = accountId => `courtiq:gym-arrival-enabled:${accountId}`;
export const gymCustomKey = accountId => `courtiq:gym-arrival-custom:${accountId}`;
export const gymStateKey = accountId => `courtiq:gym-arrival-state:${accountId}`;

// Only data about boundaries is retained locally. Never persist a user's GPS trail.
export function gymArrivalTransition(previous = {}, campuses = [], position, now = Date.now()) {
  const state = { insideId: previous.insideId || null, notifiedAt: { ...(previous.notifiedAt || {}) } };
  if (position?.lat == null || position?.lon == null || !Number.isFinite(Number(position.lat)) || !Number.isFinite(Number(position.lon))) return { state, arrival: null };
  // Boundary hysteresis avoids repeated ENTER alerts caused by GPS drift.
  if (state.insideId) {
    const earlier = campuses.find(campus => String(campus.id) === String(state.insideId));
    if (earlier && distanceMeters(position, earlier) <= DEFAULT_GYM_RADIUS_METERS + GYM_EXIT_BUFFER_METERS) {
      return { state, arrival: null };
    }
    state.insideId = null;
  }
  const inside = campuses
    .filter(campus => campus && campus.id && campus.name && campus.lat != null && campus.lon != null && Number.isFinite(Number(campus.lat)) && Number.isFinite(Number(campus.lon)))
    .map(campus => ({ campus, meters: distanceMeters(position, campus) }))
    .filter(row => row.meters <= (Number(row.campus.radius) || DEFAULT_GYM_RADIUS_METERS))
    .sort((a, b) => a.meters - b.meters)[0];
  if (!inside) return { state, arrival: null };
  state.insideId = String(inside.campus.id);
  const last = Number(state.notifiedAt[state.insideId]) || 0;
  if (last && now - last < GYM_COOLDOWN_MS) return { state, arrival: null };
  state.notifiedAt[state.insideId] = now;
  // Bound locally persisted metadata, even for frequent travelers.
  state.notifiedAt = Object.fromEntries(Object.entries(state.notifiedAt).filter(([, timestamp]) => now - timestamp < GYM_COOLDOWN_MS));
  return { state, arrival: inside.campus };
}

export function safeCustomGyms(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 25).filter(gym => typeof gym?.name === 'string' && gym.name.trim().length > 0 &&
    typeof gym?.id === 'string' && gym.id.startsWith('custom-') &&
    gym.lat != null && Number.isFinite(Number(gym.lat)) && Math.abs(Number(gym.lat)) <= 90 &&
    gym.lon != null && Number.isFinite(Number(gym.lon)) && Math.abs(Number(gym.lon)) <= 180)
    .map(gym => ({ id: gym.id, name: gym.name.slice(0, 80), city: '', lat: Number(gym.lat), lon: Number(gym.lon), radius: 250 }));
}
