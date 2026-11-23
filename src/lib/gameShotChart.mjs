// The historical shot ledger records shot zones, not pixel-level release points.
// Return grouped counts for the post-game court; never invent exact shot locations.
export function buildGameShotChartData(shotLogs = [], zones = []) {
  const safeShots = Array.isArray(shotLogs) ? shotLogs : [];
  const fieldZones = zones.filter(zone => zone?.pts === 2 || zone?.pts === 3);
  const totals = new Map(fieldZones.map(zone => [zone.id, { ...zone, made: 0, missed: 0, attempts: 0 }]));
  let ftMade = 0, ftMissed = 0, unmapped = 0;
  for (const shot of safeShots) {
    if (!shot || typeof shot.made !== 'boolean') { unmapped++; continue; }
    if (shot.zone_id === 'free-throw') {
      if (shot.made) ftMade++; else ftMissed++;
      continue;
    }
    const zone = totals.get(shot.zone_id);
    if (!zone) { unmapped++; continue; }
    zone.attempts++;
    if (shot.made) zone.made++; else zone.missed++;
  }
  const recordedZones = [...totals.values()].filter(zone => zone.attempts > 0);
  const made = recordedZones.reduce((sum, zone) => sum + zone.made, 0);
  const missed = recordedZones.reduce((sum, zone) => sum + zone.missed, 0);
  return {
    zones: recordedZones, made, missed, attempts: made + missed,
    freeThrows: { made: ftMade, missed: ftMissed, attempts: ftMade + ftMissed },
    unmapped,
  };
}
