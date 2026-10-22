import test from "node:test";
import assert from "node:assert/strict";
import { buildGymGeofences, distanceMeters, geofenceLimit, nearestGymCampuses } from "../src/lib/gymGeofence.mjs";

const campuses = Array.from({ length: 120 }, (_, index) => ({
  id: String(index + 1),
  name: `School ${index + 1}`,
  city: "Test",
  lat: 33.95 + index * 0.001,
  lon: -84.0,
}));

test("native geofence caps match platform limits", () => {
  assert.equal(geofenceLimit("ios"), 20);
  assert.equal(geofenceLimit("android"), 100);
  assert.equal(nearestGymCampuses(campuses, { lat: 33.95, lon: -84 }, "ios").length, 20);
  assert.equal(nearestGymCampuses(campuses, { lat: 33.95, lon: -84 }, "android").length, 100);
});

test("nearest campuses are ordered by distance and converted to geofence regions", () => {
  const nearest = nearestGymCampuses(campuses, { lat: 33.95, lon: -84 }, "ios");
  assert.equal(nearest[0].id, "1");
  assert.ok(nearest[1].distanceMeters > nearest[0].distanceMeters);
  const regions = buildGymGeofences(campuses, { lat: 33.95, lon: -84 }, "ios", 300);
  assert.equal(regions[0].identifier, "ga-hs-1");
  assert.equal(regions[0].radius, 300);
});

test("distance rejects incomplete locations instead of fabricating proximity", () => {
  assert.equal(distanceMeters({ lat: 33.9 }, campuses[0]), Number.POSITIVE_INFINITY);
});
