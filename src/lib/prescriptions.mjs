function pct(made, total) {
  return total > 0 ? Math.round((made / total) * 100) : 0;
}

function allowedLevels(age) {
  const numericAge = Number(age || 0);
  if (!numericAge) return ["beginner", "intermediate", "advanced"];
  if (numericAge <= 11) return ["beginner"];
  if (numericAge <= 14) return ["beginner", "intermediate"];
  if (numericAge <= 17) return ["intermediate", "advanced"];
  return ["intermediate", "advanced", "elite"];
}

function levelRank(level) {
  return { beginner: 1, intermediate: 2, advanced: 3, elite: 4 }[level] || 0;
}

function zoneLabel(zoneId = "") {
  return zoneId
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function ratingFocus(ratings) {
  if (!ratings) return null;

  const map = [
    { key: "shooting", categories: ["shooting"], label: "Shooting" },
    { key: "playmaking", categories: ["passing", "ball-handling"], label: "Playmaking" },
    { key: "rebounding", categories: ["rebounding"], label: "Rebounding" },
    { key: "defense", categories: ["defense", "agility"], label: "Defense" },
    { key: "efficiency", categories: ["conditioning", "agility"], label: "Efficiency" },
  ].filter((item) => Number.isFinite(ratings[item.key]));

  if (!map.length) return null;
  map.sort((a, b) => ratings[a.key] - ratings[b.key]);
  const weakest = map[0];
  if (ratings[weakest.key] >= 60) return null;

  return {
    type: "rating",
    categories: weakest.categories,
    title: "Build your " + weakest.label.toLowerCase(),
    reason: weakest.label + " is your lowest current CourtIQ rating at " + ratings[weakest.key] + "/99. The prescription emphasizes that area while keeping the work age-appropriate.",
    evidence: ratings[weakest.key] + "/99 " + weakest.label,
    confidence: "medium",
    tags: weakest.key === "playmaking" ? ["decision", "passing", "handles", "pressure"] : [],
  };
}

export function identifyDevelopmentFocus(sessions = [], ratings = null) {
  if (!sessions.length) {
    return {
      type: "foundation",
      categories: ["ball-handling", "shooting"],
      title: "Build your foundation",
      reason: "CourtIQ does not have enough recorded performance yet to prescribe from game evidence, so start with high-value fundamentals.",
      evidence: "No sessions analyzed yet",
      confidence: "low",
      tags: ["fundamentals", "weak-hand", "form"],
    };
  }

  const recent = sessions.slice(0, 10);
  const shots = recent.flatMap((session) => session.shot_logs || []);
  const zones = new Map();

  for (const shot of shots) {
    if (!shot?.zone_id || shot.zone_id === "free-throw") continue;
    const row = zones.get(shot.zone_id) || { total: 0, made: 0 };
    row.total += 1;
    if (shot.made) row.made += 1;
    zones.set(shot.zone_id, row);
  }

  const weakZone = [...zones.entries()]
    .map(([zoneId, stats]) => ({ zoneId, ...stats, percentage: pct(stats.made, stats.total) }))
    .filter((zone) => zone.total >= 6 && zone.percentage < 40)
    .sort((a, b) => a.percentage - b.percentage || b.total - a.total)[0];

  if (weakZone) {
    const zoneWords = weakZone.zoneId.split(/[-_]+/).filter(Boolean);
    return {
      type: "shooting-zone",
      categories: ["shooting"],
      title: "Attack the " + zoneLabel(weakZone.zoneId),
      reason: "You are " + weakZone.made + "-for-" + weakZone.total + " from this area across recent sessions. CourtIQ is using that repeated result to prescribe targeted shooting work.",
      evidence: weakZone.percentage + "% on " + weakZone.total + " attempts",
      confidence: weakZone.total >= 12 ? "high" : "medium",
      tags: [...zoneWords, "shooting", "form"],
    };
  }

  const games = recent.filter((session) => session.type === "game");
  if (games.length >= 2) {
    const stats = games.map((session) => session.game_stats || {});
    const assists = stats.reduce((sum, row) => sum + Number(row.ast || 0), 0);
    const turnovers = stats.reduce((sum, row) => sum + Number(row.to || 0), 0);
    const turnoversPerGame = turnovers / games.length;
    const assistTurnover = turnovers > 0 ? assists / turnovers : assists;

    if (turnoversPerGame >= 3 && assistTurnover < 1.5) {
      return {
        type: "ball-security",
        categories: ["ball-handling", "passing"],
        title: "Protect the possession",
        reason: "Recent games show " + turnoversPerGame.toFixed(1) + " turnovers per game and a " + assistTurnover.toFixed(1) + " assist-to-turnover ratio. The prescription emphasizes control, change of pace and passing under pressure.",
        evidence: turnoversPerGame.toFixed(1) + " TO/G · " + assistTurnover.toFixed(1) + " A/TO",
        confidence: games.length >= 4 ? "high" : "medium",
        tags: ["handles", "pressure", "passing", "decision", "change-of-pace"],
      };
    }
  }

  const rating = ratingFocus(ratings);
  if (rating) return rating;

  const practiceCount = recent.filter((session) => session.type === "practice").length;
  if (games.length >= 3 && practiceCount < Math.ceil(games.length / 2)) {
    return {
      type: "practice-balance",
      categories: ["shooting", "ball-handling", "finishing"],
      title: "Turn games into deliberate reps",
      reason: "Your recent history includes " + games.length + " games and " + practiceCount + " practice sessions. The prescription balances high-frequency skills so game feedback turns into actual practice volume.",
      evidence: practiceCount + " practices · " + games.length + " games",
      confidence: "medium",
      tags: ["game-speed", "fundamentals", "finishing", "handles"],
    };
  }

  return {
    type: "maintenance",
    categories: ["shooting", "ball-handling", "finishing", "agility"],
    title: "Stay sharp across your core skills",
    reason: "No single weakness is dominating the current sample. CourtIQ is prescribing a balanced maintenance workout until a stronger pattern appears.",
    evidence: recent.length + " recent sessions reviewed",
    confidence: "low",
    tags: ["fundamentals", "game-speed", "footwork"],
  };
}

function scoreDrill(drill, focus, preferredLevels) {
  let score = 0;
  const categoryIndex = focus.categories.indexOf(drill.category);
  if (categoryIndex === 0) score += 12;
  else if (categoryIndex > 0) score += Math.max(4, 8 - categoryIndex * 2);

  const drillTags = (drill.tags || []).map((tag) => String(tag).toLowerCase());
  for (const tag of focus.tags || []) {
    const needle = String(tag).toLowerCase();
    if (drillTags.some((value) => value.includes(needle) || needle.includes(value))) score += 2;
    if (String(drill.name || "").toLowerCase().includes(needle)) score += 1;
  }

  if (preferredLevels.includes(drill.level)) score += 3;
  if (Number(drill.duration || 0) <= 8) score += 1;
  if (drill.hasAnimation) score += 0.5;
  return score;
}

export function buildTrainingPrescription({
  sessions = [],
  ratings = null,
  drills = [],
  age = null,
  maxDrills = 4,
} = {}) {
  const focus = identifyDevelopmentFocus(sessions, ratings);
  const levels = allowedLevels(age);

  const eligible = drills
    .filter((drill) => levels.includes(drill.level))
    .map((drill) => ({ drill, score: scoreDrill(drill, focus, levels) }))
    .sort((a, b) => b.score - a.score
      || levelRank(a.drill.level) - levelRank(b.drill.level)
      || Number(a.drill.duration || 0) - Number(b.drill.duration || 0)
      || String(a.drill.id).localeCompare(String(b.drill.id)));

  const chosen = [];
  const categoryUse = new Map();

  for (const candidate of eligible) {
    if (chosen.length >= maxDrills) break;
    if (candidate.score <= 0) continue;
    const count = categoryUse.get(candidate.drill.category) || 0;
    const multiCategoryFocus = focus.categories.length > 1;
    if (multiCategoryFocus && count >= 2) continue;
    chosen.push(candidate.drill);
    categoryUse.set(candidate.drill.category, count + 1);
  }

  if (chosen.length < maxDrills) {
    for (const candidate of eligible) {
      if (chosen.length >= maxDrills) break;
      if (chosen.some((drill) => drill.id === candidate.drill.id)) continue;
      chosen.push(candidate.drill);
    }
  }

  const adapted = chosen.map((drill, index) => ({
    ...drill,
    difficulty: drill.level,
    reason: index === 0 ? "Primary focus" : focus.categories.includes(drill.category) ? "Targeted work" : "Balance",
  }));

  return {
    ...focus,
    drills: adapted,
    totalDuration: adapted.reduce((sum, drill) => sum + Number(drill.duration || 0), 0),
    levels,
  };
}
