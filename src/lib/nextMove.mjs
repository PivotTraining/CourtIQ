function pct(made, total) {
  return total > 0 ? Math.round((made / total) * 100) : 0;
}

function zoneLabel(zoneId = "") {
  return zoneId
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function ratingRecommendation(ratings) {
  if (!ratings) return null;

  const categories = [
    { key: "shooting", label: "Shooting", screen: "train", action: "Build a shooting workout", reason: "Your shooting rating is the clearest opportunity to raise your overall Court IQ." },
    { key: "playmaking", label: "Playmaking", screen: "skills", action: "Train decision-making", reason: "Your playmaking rating is lagging behind the rest of your game. Work on reads, passing and ball security." },
    { key: "rebounding", label: "Rebounding", screen: "skills", action: "Train rebounding habits", reason: "Your rebounding rating is your lowest current skill area. Focus on positioning, pursuit and finishing possessions." },
    { key: "defense", label: "Defense", screen: "skills", action: "Train defensive habits", reason: "Defense is currently your lowest-rated area. Work on stance, containment, anticipation and clean stops." },
    { key: "efficiency", label: "Efficiency", screen: "iq", action: "Review your efficiency", reason: "Efficiency is holding your overall rating back. Review where possessions are being won and lost before your next session." },
  ].filter((item) => Number.isFinite(ratings[item.key]));

  if (!categories.length) return null;
  categories.sort((a, b) => ratings[a.key] - ratings[b.key]);
  const lowest = categories[0];

  if (ratings[lowest.key] >= 55) return null;

  return {
    priority: 60,
    title: `Raise your ${lowest.label}`,
    reason: lowest.reason,
    actionLabel: lowest.action,
    screen: lowest.screen,
    metric: `${ratings[lowest.key]}/99 ${lowest.label}`,
  };
}

export function computeNextMove(sessions = [], ratings = null) {
  if (!sessions.length) {
    return {
      priority: 100,
      title: "Log your first session",
      reason: "CourtIQ needs real game or workout data before it can identify patterns and prescribe your next move.",
      actionLabel: "Start a session",
      screen: "shots",
      metric: "0 sessions analyzed",
    };
  }

  const recent = sessions.slice(0, 10);
  const allShots = recent.flatMap((session) => session.shot_logs || []);

  const zones = new Map();
  for (const shot of allShots) {
    if (!shot?.zone_id) continue;
    const current = zones.get(shot.zone_id) || { total: 0, made: 0 };
    current.total += 1;
    if (shot.made) current.made += 1;
    zones.set(shot.zone_id, current);
  }

  const weakZones = [...zones.entries()]
    .map(([zoneId, stats]) => ({ zoneId, ...stats, percentage: pct(stats.made, stats.total) }))
    .filter((zone) => zone.total >= 6 && zone.percentage < 40)
    .sort((a, b) => a.percentage - b.percentage || b.total - a.total);

  if (weakZones.length) {
    const weak = weakZones[0];
    return {
      priority: 95,
      title: `Own the ${zoneLabel(weak.zoneId)}`,
      reason: `You are ${weak.made}-for-${weak.total} from this area across your recent sessions. That is enough volume for CourtIQ to flag it as a real weakness, not a one-game swing.`,
      actionLabel: "Open heat map",
      screen: "heatmap",
      metric: `${weak.percentage}% from ${zoneLabel(weak.zoneId)}`,
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
        priority: 90,
        title: "Win the possession battle",
        reason: `You are averaging ${turnoversPerGame.toFixed(1)} turnovers with a ${assistTurnover.toFixed(1)} assist-to-turnover ratio in recent games. Cleaner decisions can improve your impact without requiring more shots.`,
        actionLabel: "Train ball security",
        screen: "skills",
        metric: `${turnoversPerGame.toFixed(1)} TO/G · ${assistTurnover.toFixed(1)} A/TO`,
      };
    }
  }

  const ratingMove = ratingRecommendation(ratings);
  if (ratingMove) return ratingMove;

  const practiceCount = recent.filter((session) => session.type === "practice").length;
  if (games.length >= 3 && practiceCount < games.length) {
    return {
      priority: 55,
      title: "Turn game data into practice reps",
      reason: `Your recent history contains ${games.length} games but only ${practiceCount} practice sessions. Use what the games exposed and deliberately train it before the next tip-off.`,
      actionLabel: "Choose a workout",
      screen: "train",
      metric: `${practiceCount} practices · ${games.length} games`,
    };
  }

  if (allShots.length < 50) {
    return {
      priority: 45,
      title: "Build a stronger sample",
      reason: `CourtIQ has only ${allShots.length} tracked shot attempts in your recent history. More intentional reps will make your heat map and shooting recommendations substantially more reliable.`,
      actionLabel: "Log a shooting session",
      screen: "shots",
      metric: `${allShots.length}/50 recent shots`,
    };
  }

  return {
    priority: 30,
    title: "Keep your strongest habit alive",
    reason: "No urgent weakness is dominating your recent data. Stay consistent, log the next session, and let CourtIQ watch for the next meaningful change in your game.",
    actionLabel: "Review My IQ",
    screen: "iq",
    metric: `${sessions.length} sessions analyzed`,
  };
}
