export const DEFAULT_GYM_RADIUS_METERS = 300;
export const IOS_GEOFENCE_LIMIT = 20;
export const ANDROID_GEOFENCE_LIMIT = 100;

const toRadians = (degrees) => (Number(degrees) * Math.PI) / 180;

export function distanceMeters(a, b) {
  const lat1 = Number(a?.lat), lon1 = Number(a?.lon);
  const lat2 = Number(b?.lat), lon2 = Number(b?.lon);
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return Number.POSITIVE_INFINITY;
  const earth = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * earth * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function geofenceLimit(platform = "") {
  const value = String(platform).toLowerCase();
  if (value.includes("ios") || value.includes("iphone") || value.includes("ipad")) return IOS_GEOFENCE_LIMIT;
  if (value.includes("android")) return ANDROID_GEOFENCE_LIMIT;
  return IOS_GEOFENCE_LIMIT;
}

export function nearestGymCampuses(campuses = [], position, platform = "ios") {
  const limit = geofenceLimit(platform);
  return campuses
    .map((campus) => ({ ...campus, distanceMeters: distanceMeters(position, campus) }))
    .filter((campus) => Number.isFinite(campus.distanceMeters))
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, limit);
}

export function buildGymGeofences(campuses = [], position, platform = "ios", radiusMeters = DEFAULT_GYM_RADIUS_METERS) {
  return nearestGymCampuses(campuses, position, platform).map((campus) => ({
    identifier: `ga-hs-${campus.id}`,
    name: campus.name,
    city: campus.city,
    latitude: Number(campus.lat),
    longitude: Number(campus.lon),
    radius: Math.max(100, Number(radiusMeters) || DEFAULT_GYM_RADIUS_METERS),
  }));
}
