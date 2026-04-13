import { COURT_ZONES, ZONE_CATEGORIES } from "./constants";
import { calcPct } from "./utils";

/* ══════════════════════════════════════════════════════
   COURT IQ INTELLIGENCE ENGINE
   Computes player memory, trends, skill ratings,
   and season stats from raw session + shot data.
   ══════════════════════════════════════════════════════ */

// ─── HELPERS ───

function getMonthSessions(sessions, monthsAgo = 0) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  const end = new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 0, 23, 59, 59);
  return sessions.filter((s) => {
    const d = new Date(s.created_at);
    return d >= start && d <= end;
  });
}

function sessionPts(session) {
  const shots = session.shot_logs || [];
  const stats = session.game_stats || {};
  return shots.filter((s) => s.made).reduce((sum, s) => {
    const zone = COURT_ZONES.find((z) => z.id === s.zone_id);
    return sum + (zone?.pts || 2);
  }, 0) + (stats.ft_made || 0);
}

function sessionFgPct(session) {
  const shots = session.shot_logs || [];
  if (shots.length === 0) return null;
  return calcPct(shots.filter((s) => s.made).length, shots.length);
}

// ─── 1. PLAYER MEMORY (patterns, tendencies, improvements) ───

export function computePlayerMemory(sessions) {
  if (sessions.length === 0) return { insights: [], weakZones: [], strongZones: [], tendencies: [] };

  const allShots = sessions.flatMap((s) => (s.shot_logs || []).map((sh) => ({ ...sh, created_at: s.created_at })));
  const recentSessions = sessions.slice(0, 10);
  const olderSessions = sessions.slice(10, 20);

  // Zone analysis
  const zoneStats = {};
  for (const shot of allShots) {
    if (!zoneStats[shot.zone_id]) zoneStats[shot.zone_id] = { total: 0, made: 0 };
    zoneStats[shot.zone_id].total++;
    if (shot.made) zoneStats[shot.zone_id].made++;
  }

  const zones = COURT_ZONES.map((z) => {
    const s = zoneStats[z.id] || { total: 0, made: 0 };
    return { ...z, total: s.total, made: s.made, pct: calcPct(s.made, s.total) };
  }).filter((z) => z.total > 0);

  const strongZones = zones.filter((z) => z.pct >= 50 && z.total >= 5).sort((a, b) => b.pct - a.pct).slice(0, 3);
  const weakZones = zones.filter((z) => z.pct < 40 && z.total >= 5).sort((a, b) => a.pct - b.pct).slice(0, 3);

  // Recent vs older improvement detection
  const insights = [];
  if (recentSessions.length >= 3 && olderSessions.length >= 3) {
    const recentAvgPct = recentSessions.map(sessionFgPct).filter(Boolean);
    const olderAvgPct = olderSessions.map(sessionFgPct).filter(Boolean);
    if (recentAvgPct.length > 0 && olderAvgPct.length > 0) {
      const recentAvg = Math.round(recentAvgPct.reduce((a, b) => a + b, 0) / recentAvgPct.length);
      const olderAvg = Math.round(olderAvgPct.reduce((a, b) => a + b, 0) / olderAvgPct.length);
      const diff = recentAvg - olderAvg;
      if (diff > 5) insights.push({ icon: "trending", text: `Your shooting is up ${diff}% compared to your earlier sessions. The work is paying off.`, type: "positive" });
      else if (diff < -5) insights.push({ icon: "trending", text: `Shooting has dipped ${Math.abs(diff)}% recently. Time to get back to fundamentals.`, type: "warning" });
    }
  }

  // Tendency detection
  const tendencies = [];
  const threeShots = allShots.filter((s) => ZONE_CATEGORIES.threes.includes(s.zone_id));
  const twoShots = allShots.filter((s) => !ZONE_CATEGORIES.threes.includes(s.zone_id) && s.zone_id !== "free-throw");
  if (threeShots.length > twoShots.length * 1.5 && threeShots.length >= 10) {
    tendencies.push({ icon: "target", text: "You're a perimeter-heavy scorer. Consider adding mid-range attacks for balance." });
  } else if (twoShots.length > threeShots.length * 2 && twoShots.length >= 10) {
    tendencies.push({ icon: "muscle", text: "You dominate in the paint. Expanding your three-point range would make you harder to guard." });
  }

  // Favorite zone
  const favZone = zones.sort((a, b) => b.total - a.total)[0];
  if (favZone && favZone.total >= 5) {
    tendencies.push({ icon: "map", text: `Your go-to spot is ${favZone.label} (${favZone.total} shots, ${favZone.pct}%). ${favZone.pct >= 50 ? "Keep attacking it." : "Work on consistency from here."}` });
  }

  // Improvement zones (zones where recent pct > older pct)
  for (const zone of COURT_ZONES) {
    const recentZoneShots = recentSessions.flatMap((s) => (s.shot_logs || []).filter((sh) => sh.zone_id === zone.id));
    const olderZoneShots = olderSessions.flatMap((s) => (s.shot_logs || []).filter((sh) => sh.zone_id === zone.id));
    if (recentZoneShots.length >= 5 && olderZoneShots.length >= 5) {
      const recentPct = calcPct(recentZoneShots.filter((s) => s.made).length, recentZoneShots.length);
      const olderPct = calcPct(olderZoneShots.filter((s) => s.made).length, olderZoneShots.length);
      if (recentPct - olderPct >= 15) {
        insights.push({ icon: "fire", text: `${zone.label} is heating up — up ${recentPct - olderPct}% recently.`, type: "positive" });
      }
    }
  }

  // Session frequency
  if (sessions.length >= 3) {
    const gameSessions = sessions.filter((s) => s.type === "game");
    const practiceSessions = sessions.filter((s) => s.type === "practice");
    const ratio = practiceSessions.length / Math.max(gameSessions.length, 1);
    if (ratio < 1 && gameSessions.length >= 3) {
      insights.push({ icon: "zap", text: "You're playing more games than practices. Add more practice sessions to sharpen your skills.", type: "info" });
    } else if (ratio >= 3) {
      insights.push({ icon: "trophy", text: "Lots of practice reps! Make sure you're testing yourself in games too.", type: "info" });
    }
  }

  return { insights, weakZones, strongZones, tendencies };
}

// ─── 2. TREND COMPARISON (this month vs last month) ───

export function computeTrends(sessions) {
  const thisMonth = getMonthSessions(sessions, 0);
  const lastMonth = getMonthSessions(sessions, 1);

  function monthStats(monthSessions) {
    const games = monthSessions.filter((s) => s.type === "game");
    const allShots = monthSessions.flatMap((s) => s.shot_logs || []);
    const allStats = monthSessions.map((s) => s.game_stats || {});

    const fgMade = allShots.filter((s) => s.made).length;
    const fgTotal = allShots.length;
    const threes = allShots.filter((s) => ZONE_CATEGORIES.threes.includes(s.zone_id));
    const threesMade = threes.filter((s) => s.made).length;

    const totalPts = monthSessions.reduce((sum, s) => sum + sessionPts(s), 0);
    const totalAst = allStats.reduce((sum, s) => sum + (s.ast || 0), 0);
    const totalReb = allStats.reduce((sum, s) => sum + (s.reb || 0), 0);
    const totalStl = allStats.reduce((sum, s) => sum + (s.stl || 0), 0);
    const totalTo = allStats.reduce((sum, s) => sum + (s.to || 0), 0);
    const gamesPlayed = games.length;

    return {
      sessions: monthSessions.length,
      games: gamesPlayed,
      fgPct: calcPct(fgMade, fgTotal),
      threePct: calcPct(threesMade, threes.length),
      totalPts,
      ppg: gamesPlayed > 0 ? (totalPts / gamesPlayed).toFixed(1) : "0",
      apg: gamesPlayed > 0 ? (totalAst / gamesPlayed).toFixed(1) : "0",
      rpg: gamesPlayed > 0 ? (totalReb / gamesPlayed).toFixed(1) : "0",
      spg: gamesPlayed > 0 ? (totalStl / gamesPlayed).toFixed(1) : "0",
      topg: gamesPlayed > 0 ? (totalTo / gamesPlayed).toFixed(1) : "0",
      totalShots: fgTotal,
    };
  }

  const current = monthStats(thisMonth);
  const previous = monthStats(lastMonth);

  function delta(curr, prev) {
    const c = parseFloat(curr);
    const p = parseFloat(prev);
    if (p === 0 && c === 0) return { value: 0, direction: "flat" };
    if (p === 0) return { value: c, direction: "up" };
    const diff = c - p;
    return { value: Math.abs(diff).toFixed(1), direction: diff > 0.5 ? "up" : diff < -0.5 ? "down" : "flat" };
  }

  return {
    current,
    previous,
    deltas: {
      fgPct: delta(current.fgPct, previous.fgPct),
      threePct: delta(current.threePct, previous.threePct),
      ppg: delta(current.ppg, previous.ppg),
      apg: delta(current.apg, previous.apg),
      rpg: delta(current.rpg, previous.rpg),
    },
  };
}

// ─── 3. SKILL RATINGS (composite scores, radar chart) ───

export function computeSkillRatings(sessions) {
  if (sessions.length === 0) {
    return { overall: 0, shooting: 0, playmaking: 0, rebounding: 0, defense: 0, efficiency: 0 };
  }

  const gameSessions = sessions.filter((s) => s.type === "game");
  const allShots = sessions.flatMap((s) => s.shot_logs || []);
  const allStats = sessions.map((s) => s.game_stats || {});
  const gamesPlayed = Math.max(gameSessions.length, 1);

  const totalSessions = sessions.length;

  // ═══ EXPERIENCE GATES ═══
  // Can't reach high tiers without putting in the work.
  // < 5 sessions: capped at 45 (Developing max)
  // < 10 sessions: capped at 65 (Solid max)
  // < 20 sessions: capped at 80 (Advanced max)
  // < 40 sessions: capped at 92
  // 40+ sessions: uncapped (Elite possible)
  const expCap = totalSessions < 5 ? 45 : totalSessions < 10 ? 65 : totalSessions < 20 ? 80 : totalSessions < 40 ? 92 : 99;

  // ═══ SHOOTING (0-99) ═══
  // NBA avg FG% ~46%. Curve makes it hard above 60.
  const fgPct = allShots.length > 0 ? (allShots.filter((s) => s.made).length / allShots.length) * 100 : 0;
  const threes = allShots.filter((s) => ZONE_CATEGORIES.threes.includes(s.zone_id));
  const threePct = threes.length > 0 ? (threes.filter((s) => s.made).length / threes.length) * 100 : 0;
  const shotVolumeFactor = Math.min(allShots.length / 50, 1);
  const baseShoot = fgPct <= 30 ? fgPct * 0.67 : 20 + (fgPct - 30) * 1.6;
  const threeBonus = threes.length >= 10 ? Math.min(12, Math.max(0, (threePct - 30) * 0.4)) : 0;
  const shooting = Math.min(expCap, Math.max(0, Math.round((baseShoot + threeBonus) * shotVolumeFactor)));

  // ═══ PLAYMAKING (0-99) ═══
  const totalAst = allStats.reduce((sum, s) => sum + (s.ast || 0), 0);
  const totalTo = allStats.reduce((sum, s) => sum + (s.to || 0), 0);
  const astPerGame = totalAst / gamesPlayed;
  const toPerGame = totalTo / gamesPlayed;
  const astToRatio = totalTo > 0 ? totalAst / totalTo : Math.min(totalAst, 3);
  const basePlay = Math.min(85, astPerGame * astPerGame * 1.3);
  const ratioBonus = Math.min(15, Math.max(0, (astToRatio - 1) * 5));
  const toPenalty = Math.max(0, (toPerGame - 3) * 4);
  const playmaking = Math.min(expCap, Math.max(0, Math.round(basePlay + ratioBonus - toPenalty)));

  // ═══ REBOUNDING (0-99) ═══
  const totalReb = allStats.reduce((sum, s) => sum + (s.reb || 0), 0);
  const rpg = totalReb / gamesPlayed;
  const rebounding = Math.min(expCap, Math.max(0, Math.round(rpg * rpg * 0.7 + rpg * 3)));

  // ═══ DEFENSE (0-99) ═══
  const totalStl = allStats.reduce((sum, s) => sum + (s.stl || 0), 0);
  const totalBlk = allStats.reduce((sum, s) => sum + (s.blk || 0), 0);
  const totalPf = allStats.reduce((sum, s) => sum + (s.pf || 0), 0);
  const stlPerGame = totalStl / gamesPlayed;
  const blkPerGame = totalBlk / gamesPlayed;
  const pfPerGame = totalPf / gamesPlayed;
  const baseDef = stlPerGame * 14 + blkPerGame * 12;
  const foulBonus = pfPerGame < 2 ? 5 : pfPerGame > 4 ? -5 : 0;
  const defense = Math.min(expCap, Math.max(0, Math.round(baseDef + foulBonus)));

  // ═══ EFFICIENCY (0-99) ═══
  const totalPts = sessions.reduce((sum, s) => sum + sessionPts(s), 0);
  const fgMade = allShots.filter((s) => s.made).length;
  const fgAttempted = allShots.length;
  const ftMiss = allStats.reduce((sum, s) => sum + ((s.ft_total || 0) - (s.ft_made || 0)), 0);
  const gameScore = (totalPts + 0.4 * fgMade - 0.7 * fgAttempted - 0.4 * ftMiss + 0.7 * totalReb + 0.7 * totalAst + totalStl + 0.7 * totalBlk - 0.4 * totalPf - totalTo) / gamesPlayed;
  const efficiency = Math.min(expCap, Math.max(0, Math.round(gameScore * 2.8 + 10)));

  // ═══ OVERALL ═══
  const rawOverall = Math.round(
    shooting * 0.30 + playmaking * 0.20 + rebounding * 0.12 + defense * 0.13 + efficiency * 0.25
  );
  const consistencyBonus = Math.min(5, Math.floor(totalSessions / 8));
  const overall = Math.min(expCap, Math.max(0, rawOverall + consistencyBonus));

  return { overall, shooting, playmaking, rebounding, defense, efficiency };
}

// ─── 4. SEASON STATS (aggregated career view) ───

export function computeSeasonStats(sessions) {
  const gameSessions = sessions.filter((s) => s.type === "game");
  const practiceSessions = sessions.filter((s) => s.type === "practice");
  const allShots = sessions.flatMap((s) => s.shot_logs || []);
  const allStats = sessions.map((s) => s.game_stats || {});
  const gamesPlayed = gameSessions.length;

  const fgMade = allShots.filter((s) => s.made).length;
  const threes = allShots.filter((s) => ZONE_CATEGORIES.threes.includes(s.zone_id));
  const threesMade = threes.filter((s) => s.made).length;
  const twos = allShots.filter((s) => !ZONE_CATEGORIES.threes.includes(s.zone_id) && s.zone_id !== "free-throw");
  const twosMade = twos.filter((s) => s.made).length;

  const totalPts = sessions.reduce((sum, s) => sum + sessionPts(s), 0);
  const totalAst = allStats.reduce((sum, s) => sum + (s.ast || 0), 0);
  const totalReb = allStats.reduce((sum, s) => sum + (s.reb || 0), 0);
  const totalStl = allStats.reduce((sum, s) => sum + (s.stl || 0), 0);
  const totalBlk = allStats.reduce((sum, s) => sum + (s.blk || 0), 0);
  const totalTo = allStats.reduce((sum, s) => sum + (s.to || 0), 0);
  const totalMin = allStats.reduce((sum, s) => sum + (s.min || 0), 0);

  // Highs
  const gameHighPts = gameSessions.reduce((max, s) => Math.max(max, sessionPts(s)), 0);
  const gameHighAst = gameSessions.reduce((max, s) => Math.max(max, (s.game_stats?.ast || 0)), 0);
  const gameHighReb = gameSessions.reduce((max, s) => Math.max(max, (s.game_stats?.reb || 0)), 0);

  // Per-game sparkline data (last 10 games)
  const last10 = gameSessions.slice(0, 10).reverse().map((s) => ({
    pts: sessionPts(s),
    fgPct: sessionFgPct(s) || 0,
    date: new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }));

  return {
    gamesPlayed,
    practiceSessions: practiceSessions.length,
    totalSessions: sessions.length,
    totalShots: allShots.length,
    fgPct: calcPct(fgMade, allShots.length),
    threePct: calcPct(threesMade, threes.length),
    twoPct: calcPct(twosMade, twos.length),
    totalPts,
    ppg: gamesPlayed > 0 ? (totalPts / gamesPlayed).toFixed(1) : "0",
    apg: gamesPlayed > 0 ? (totalAst / gamesPlayed).toFixed(1) : "0",
    rpg: gamesPlayed > 0 ? (totalReb / gamesPlayed).toFixed(1) : "0",
    spg: gamesPlayed > 0 ? (totalStl / gamesPlayed).toFixed(1) : "0",
    bpg: gamesPlayed > 0 ? (totalBlk / gamesPlayed).toFixed(1) : "0",
    topg: gamesPlayed > 0 ? (totalTo / gamesPlayed).toFixed(1) : "0",
    mpg: gamesPlayed > 0 ? (totalMin / gamesPlayed).toFixed(0) : "0",
    highs: { pts: gameHighPts, ast: gameHighAst, reb: gameHighReb },
    last10,
  };
}
