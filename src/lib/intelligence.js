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

// ─── 4. COACH REPORT (deep, specific critique + genuine praise) ───
//
// NBA reference benchmarks used for context-setting:
//   FG%: 46%  |  3PT%: 36%  |  2PT%: 51%
//   APG: 4.5  |  RPG: 4.3   |  SPG: 0.9  |  BPG: 0.4  |  TOPG: 1.5

export function computeCoachReport(sessions, ratings) {
  if (!sessions || sessions.length < 3) return [];

  const allShots      = sessions.flatMap((s) => s.shot_logs || []);
  const allStats      = sessions.map((s) => s.game_stats || {});
  const gameSessions  = sessions.filter((s) => s.type === "game");
  const gamesPlayed   = Math.max(gameSessions.length, 1);

  const report = [];

  // ══ SHOOTING ══
  const fgMade  = allShots.filter((s) => s.made).length;
  const fgTotal = allShots.length;
  const fgPct   = fgTotal >= 15 ? Math.round((fgMade / fgTotal) * 100) : null;

  const threes     = allShots.filter((s) => ZONE_CATEGORIES.threes.includes(s.zone_id));
  const threePct   = threes.length >= 10 ? Math.round((threes.filter((s) => s.made).length / threes.length) * 100) : null;

  const twos    = allShots.filter((s) => !ZONE_CATEGORIES.threes.includes(s.zone_id) && s.zone_id !== "free-throw");
  const twoPct  = twos.length >= 10 ? Math.round((twos.filter((s) => s.made).length / twos.length) * 100) : null;

  if (fgPct !== null) {
    if (fgPct >= 55) {
      report.push({
        category: "shooting", type: "praise",
        title: "Elite Efficiency",
        text: `${fgPct}% FG is genuinely elite — the NBA average is 46%. You're not just shooting, you're choosing well and finishing. This is your biggest asset. Keep attacking your proven spots.`,
        icon: "fire", color: "#22C55E",
      });
    } else if (fgPct >= 46) {
      report.push({
        category: "shooting", type: "praise",
        title: "Above-Average Shooter",
        text: `At ${fgPct}% FG you're above the 46% NBA baseline. That's real efficiency — you're converting shots that matter and not wasting possessions. The next step is pushing volume without letting the percentage drop.`,
        icon: "target", color: "#22C55E",
      });
    } else if (fgPct >= 38) {
      report.push({
        category: "shooting", type: "info",
        title: "Shooting Needs Refinement",
        text: `${fgPct}% FG is below the 46% NBA average. You're either forcing difficult looks, settling early in the shot clock, or mechanical issues are surfacing under pressure. Identify your two or three highest-percentage zones and live there. Expand from strength, not desperation.`,
        icon: "target", color: "#F59E0B",
      });
    } else {
      report.push({
        category: "shooting", type: "warning",
        title: "Shot Selection Is the Problem",
        text: `${fgPct}% FG means fewer than 4-in-10 shots go in — that's a significant drag on your team's offense. The fix isn't working harder on your jumper in isolation. It's choosing better shots: more paint touches, more catch-and-shoot opportunities, fewer pull-ups off the bounce. Run Form Shooting drills until mechanics are automatic.`,
        icon: "target", color: "#EF4444",
      });
    }
  }

  if (threePct !== null) {
    if (threePct >= 40) {
      report.push({
        category: "shooting", type: "praise",
        title: "Sharpshooter Threat",
        text: `${threePct}% from three is a genuine weapon — only elite NBA shooters clear 40%. Defenders have to chase you off the arc, which creates driving lanes and open cuts for teammates. This changes how an entire defense schemes against you.`,
        icon: "fire", color: "#22C55E",
      });
    } else if (threePct < 28 && threes.length >= 12) {
      report.push({
        category: "shooting", type: "warning",
        title: "Three-Point Attempts Hurting You",
        text: `${threePct}% from three on ${threes.length} attempts is costing possessions. At sub-28%, a two-point attempt almost always creates more value. Either cut back dramatically on threes until mechanics improve, or commit to dedicated arc shooting sessions before relying on it in games.`,
        icon: "target", color: "#EF4444",
      });
    } else if (threePct >= 33 && threePct < 40) {
      report.push({
        category: "shooting", type: "info",
        title: "Respectable Range",
        text: `${threePct}% from three is functional — above the break-even point. Defenders will respect it, but won't fear it. Adding 5–7% from your corners specifically (typically the highest-percentage three) would make your range a real weapon.`,
        icon: "target", color: "#F59E0B",
      });
    }
  }

  // ══ PLAYMAKING ══
  const totalAst = allStats.reduce((sum, s) => sum + (s.ast || 0), 0);
  const totalTo  = allStats.reduce((sum, s) => sum + (s.to || 0), 0);
  const apg  = totalAst / gamesPlayed;
  const topg = totalTo / gamesPlayed;
  const astToRatio = totalTo > 0 ? (totalAst / totalTo).toFixed(1) : totalAst > 0 ? "∞" : null;

  if (gameSessions.length >= 3) {
    if (apg >= 7) {
      report.push({
        category: "playmaking", type: "praise",
        title: "Elite Floor General",
        text: `${apg.toFixed(1)} assists per game is elite point guard territory. You see the floor before plays develop, not after. That decision-making advantage makes everyone around you more dangerous — your basketball IQ shows up in teammates' shot quality.`,
        icon: "star", color: "#22C55E",
      });
    } else if (apg >= 4) {
      report.push({
        category: "playmaking", type: "praise",
        title: "Strong Facilitator",
        text: `${apg.toFixed(1)} APG shows you're distributing effectively, not just creating for yourself. ${astToRatio ? `Your ${astToRatio}:1 assist-to-turnover ratio tells the real story — you're making smart decisions under pressure.` : ""} Teams need players who make others better.`,
        icon: "star", color: "#22C55E",
      });
    }

    if (topg >= 3.5) {
      report.push({
        category: "playmaking", type: "warning",
        title: "Turnovers Are Costing You Games",
        text: `${topg.toFixed(1)} turnovers per game is a serious problem. Every turnover is a gifted possession — at 3.5+ per game that's giving the opponent roughly 7 points of value for free across the game. Slow down in traffic, choose simpler passes when contested, and stop dribbling into defenders. Protecting the ball is a skill. Practice it.`,
        icon: "zap", color: "#EF4444",
      });
    } else if (topg < 1.5 && gameSessions.length >= 4) {
      report.push({
        category: "playmaking", type: "praise",
        title: "Ball Security",
        text: `${topg.toFixed(1)} turnovers per game is excellent. You're protecting possessions when it counts — that quiet discipline is one of the most undervalued skills in the game. Coaches notice this even when the box score doesn't show it.`,
        icon: "trophy", color: "#22C55E",
      });
    }
  }

  // ══ REBOUNDING ══
  const totalReb = allStats.reduce((sum, s) => sum + (s.reb || 0), 0);
  const rpg = totalReb / gamesPlayed;

  if (gameSessions.length >= 3) {
    if (rpg >= 10) {
      report.push({
        category: "rebounding", type: "praise",
        title: "Dominant on the Glass",
        text: `${rpg.toFixed(1)} rebounds per game is double-double territory. You're controlling the possession battle on both ends. That physical presence changes how opponents attack — they know they can't afford to miss shots against you.`,
        icon: "muscle", color: "#22C55E",
      });
    } else if (rpg >= 6) {
      report.push({
        category: "rebounding", type: "praise",
        title: "Solid Rebounder",
        text: `${rpg.toFixed(1)} RPG puts you above NBA average for most positions. Your effort on the glass shows up in the box score in ways that go unnoticed until someone films your game — you're winning possessions that others give up.`,
        icon: "trophy", color: "#22C55E",
      });
    } else if (rpg < 2.5 && gameSessions.length >= 4) {
      report.push({
        category: "rebounding", type: "info",
        title: "Rebounding Effort Gap",
        text: `${rpg.toFixed(1)} RPG is on the low side. Even perimeter players need to attack the glass — crashing from the weak side and boxing out costs zero athleticism. It's positioning and want-to. Guards who rebound at 4+ RPG are a genuine advantage because opponents don't expect it.`,
        icon: "zap", color: "#F59E0B",
      });
    }
  }

  // ══ DEFENSE ══
  const totalStl = allStats.reduce((sum, s) => sum + (s.stl || 0), 0);
  const totalBlk = allStats.reduce((sum, s) => sum + (s.blk || 0), 0);
  const totalPf  = allStats.reduce((sum, s) => sum + (s.pf || 0), 0);
  const spg = totalStl / gamesPlayed;
  const bpg = totalBlk / gamesPlayed;
  const pfpg = totalPf / gamesPlayed;

  if (gameSessions.length >= 3) {
    if (spg >= 2.5) {
      report.push({
        category: "defense", type: "praise",
        title: "Disruptive Defender",
        text: `${spg.toFixed(1)} steals per game is exceptional — you're reading the offense before it develops. That anticipation translates directly to transition points on the other end. Defenders who gamble and get away with it do so because they understand offensive patterns, not just because they're fast.`,
        icon: "fire", color: "#22C55E",
      });
    } else if (spg >= 1.5) {
      report.push({
        category: "defense", type: "praise",
        title: "Active Hands",
        text: `${spg.toFixed(1)} steals per game is well above average. You're staying active defensively and creating opportunities — that pressure changes how opponents handle the ball around you.`,
        icon: "target", color: "#22C55E",
      });
    }
    if (bpg >= 2) {
      report.push({
        category: "defense", type: "praise",
        title: "Rim Protector",
        text: `${bpg.toFixed(1)} blocks per game is elite. You're altering shots beyond just the ones you swat — opponents hesitate attacking your side of the paint. That hesitation is worth just as much as the actual blocks.`,
        icon: "fire", color: "#22C55E",
      });
    }
    if (pfpg >= 4.5) {
      report.push({
        category: "defense", type: "warning",
        title: "Foul Trouble Is Limiting You",
        text: `${pfpg.toFixed(1)} fouls per game is unsustainable — you're either out of the game early or playing soft late. Most foul issues come from defending in the wrong position or biting on pump fakes. Stay lower, stay in front, and contest vertically. You can't help the team in the fourth quarter from the bench.`,
        icon: "zap", color: "#EF4444",
      });
    }
  }

  // ══ CONSISTENCY ANALYSIS ══
  if (sessions.length >= 5) {
    const last5FgPcts = sessions.slice(0, 5).map(sessionFgPct).filter(Boolean);
    if (last5FgPcts.length >= 4) {
      const avg = last5FgPcts.reduce((a, b) => a + b, 0) / last5FgPcts.length;
      const variance = last5FgPcts.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / last5FgPcts.length;
      const stdDev = Math.sqrt(variance);

      if (stdDev > 17) {
        report.push({
          category: "consistency", type: "warning",
          title: "Inconsistent Output",
          text: `Your last ${last5FgPcts.length} sessions show wide swings in shooting efficiency (${Math.min(...last5FgPcts)}%–${Math.max(...last5FgPcts)}%). That variance usually signals a mechanical issue that surfaces under game pressure — your shot changes when things get hard. Compare your slowest sessions to your best ones and identify what's different. One thing usually is.`,
          icon: "trending", color: "#F59E0B",
        });
      } else if (stdDev < 7 && avg >= 44) {
        report.push({
          category: "consistency", type: "praise",
          title: "Rock-Solid Consistency",
          text: `You're shooting ${Math.round(avg)}% across your recent sessions with minimal variance. That reliability is rare — you don't have off nights, you just show up. Coaches build game plans around players like this because they can predict what they'll get.`,
          icon: "trophy", color: "#22C55E",
        });
      }
    }

    // Consecutive session decline detector
    const recentPcts = sessions.slice(0, 5).map(sessionFgPct).filter(Boolean);
    if (recentPcts.length >= 3) {
      let declineStreak = 1;
      for (let i = 1; i < recentPcts.length; i++) {
        if (recentPcts[i] < recentPcts[i - 1] - 3) declineStreak++;
        else break;
      }
      if (declineStreak >= 3) {
        report.push({
          category: "consistency", type: "warning",
          title: `${declineStreak}-Session Decline — Take Notice`,
          text: `Your efficiency has dropped in ${declineStreak} consecutive sessions. This isn't bad luck — something real is changing. It could be fatigue, mechanical drift, shot selection creep, or a mental pattern. Get back to your most basic, proven spots and rebuild from there. Don't try to shoot your way out of a slump with harder shots.`,
          icon: "trending", color: "#EF4444",
        });
      }
    }
  }

  // ══ SKILL CEILING & WEAKEST LINK ══
  if (ratings && sessions.length >= 5) {
    const skillScores = [
      { key: "shooting",   label: "Shooting",   score: ratings.shooting   || 0, drills: "Spot Shooting, Catch-and-Shoot, or Form Shooting drills" },
      { key: "playmaking", label: "Playmaking",  score: ratings.playmaking || 0, drills: "Ball Handling, Pick-and-Roll reads, or 2-on-2 decision drills" },
      { key: "rebounding", label: "Rebounding",  score: ratings.rebounding || 0, drills: "Box-Out drills, Tip Drill, or positioning and crash work" },
      { key: "defense",    label: "Defense",     score: ratings.defense    || 0, drills: "Closeout drills, defensive slides, or 1-on-1 containment" },
    ];

    const weakest  = skillScores.filter((s) => s.score < 55).sort((a, b) => a.score - b.score)[0];
    const strongest = [...skillScores].sort((a, b) => b.score - a.score)[0];

    if (weakest) {
      report.push({
        category: "improvement", type: "info",
        title: `Weakest Link: ${weakest.label} (${weakest.score}/99)`,
        text: `Your ${weakest.label} is the primary cap on your overall IQ. A chain breaks at its weakest link — the ceiling of a well-rounded player rises when every skill is at least functional. Attack this with ${weakest.drills}. Your other tools are already working for you; this is what unlocks the next level.`,
        icon: "zap", color: "#8B5CF6",
      });
    }

    if (strongest && strongest.score >= 62) {
      report.push({
        category: "strength", type: "praise",
        title: `Best Weapon: ${strongest.label} (${strongest.score}/99)`,
        text: `Your ${strongest.label} is your highest-rated skill at ${strongest.score}/99. Build your game around this — when you play through your strengths, your other attributes get more space to operate. Great players don't hide their best skill, they create situations where it shows up repeatedly.`,
        icon: "star", color: "#22C55E",
      });
    }
  }

  // Return up to 7 most impactful insights (already ordered by logic above)
  return report.slice(0, 7);
}

// ─── 5. SEASON STATS (aggregated career view) ───

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

// ─── 6. TEAM IQ (aggregate intelligence across a roster) ───
//
// playerDataArray: [{ name, sessions }]
// Returns { teamRatings, players, insights }

export function computeTeamIQ(playerDataArray) {
  if (!playerDataArray || playerDataArray.length < 1) return null;

  // Per-player compute
  const players = playerDataArray.map(({ name, sessions }) => {
    const ratings = computeSkillRatings(sessions);
    const season  = computeSeasonStats(sessions);
    return { name, ratings, season, sessionCount: sessions.length };
  }).filter((p) => p.sessionCount > 0);

  if (players.length === 0) return null;

  // Team aggregate ratings (weighted by games played)
  const totalGames = players.reduce((s, p) => s + (p.season.gamesPlayed || 0), 0) || 1;
  const w = (p) => (p.season.gamesPlayed || 1) / totalGames;

  const teamRatings = {
    overall:    Math.round(players.reduce((s, p) => s + p.ratings.overall    * w(p), 0)),
    shooting:   Math.round(players.reduce((s, p) => s + p.ratings.shooting   * w(p), 0)),
    playmaking: Math.round(players.reduce((s, p) => s + p.ratings.playmaking * w(p), 0)),
    rebounding: Math.round(players.reduce((s, p) => s + p.ratings.rebounding * w(p), 0)),
    defense:    Math.round(players.reduce((s, p) => s + p.ratings.defense    * w(p), 0)),
    efficiency: Math.round(players.reduce((s, p) => s + p.ratings.efficiency * w(p), 0)),
  };

  // Team season aggregates (sum, then divide by player count for per-team averages)
  const n = Math.max(players.length, 1);
  const teamSeason = {
    gamesPlayed: Math.max(...players.map((p) => p.season.gamesPlayed || 0)),
    ppg:  (players.reduce((s, p) => s + parseFloat(p.season.ppg  || 0), 0) / n).toFixed(1),
    apg:  (players.reduce((s, p) => s + parseFloat(p.season.apg  || 0), 0) / n).toFixed(1),
    rpg:  (players.reduce((s, p) => s + parseFloat(p.season.rpg  || 0), 0) / n).toFixed(1),
    fgPct: Math.round(players.reduce((s, p) => s + (p.season.fgPct || 0), 0) / n),
    threePct: Math.round(players.reduce((s, p) => s + (p.season.threePct || 0), 0) / n),
  };

  // Team-level insights
  const insights = [];

  // Shooting identity
  if (teamSeason.fgPct >= 50) {
    insights.push({ icon: "fire", color: "#22C55E", type: "praise", title: "High-Efficiency Offense", text: `Your team is shooting ${teamSeason.fgPct}% from the field — well above the 46% NBA average. You're getting good shots and converting them. That efficiency compounds: fewer possessions wasted means more scoring opportunities each game.` });
  } else if (teamSeason.fgPct < 40 && teamSeason.fgPct > 0) {
    insights.push({ icon: "target", color: "#EF4444", type: "warning", title: "Shot Quality Issue", text: `${teamSeason.fgPct}% team FG% means you're leaving points on the table every game. Work on getting everyone into their most productive zones and cutting down on contested pull-ups. One or two percentage points across your whole roster compounds into a significant scoring edge.` });
  }

  // Playmaking balance
  const avgAPG = parseFloat(teamSeason.apg);
  if (avgAPG >= 5) {
    insights.push({ icon: "star", color: "#22C55E", type: "praise", title: "Ball-Movement Culture", text: `${teamSeason.apg} assists per player per game means your team is sharing the ball. That style of play is proven to create higher-quality shots and harder defensive assignments for opponents. Keep rewarding the extra pass.` });
  }

  // Rebounding depth
  const avgRPG = parseFloat(teamSeason.rpg);
  if (avgRPG >= 6) {
    insights.push({ icon: "muscle", color: "#22C55E", type: "praise", title: "Dominant on the Glass", text: `${teamSeason.rpg} rebounds per player per game is exceptional team rebounding. Controlling the boards is controlling the game — extra possessions turn into points, and opponents can't get second-chance opportunities.` });
  } else if (avgRPG < 3 && teamSeason.gamesPlayed >= 3) {
    insights.push({ icon: "zap", color: "#F59E0B", type: "info", title: "Rebounding Gap", text: `${teamSeason.rpg} RPG per player is low. Teams that get outrebounded lose possessions — that's an invisible deficit that shows up as the game goes on. Everyone needs to crash the glass, not just your bigs.` });
  }

  // Roster balance — who is carrying vs who needs development
  if (players.length >= 2) {
    const sorted = [...players].sort((a, b) => b.ratings.overall - a.ratings.overall);
    const top = sorted[0];
    const bottom = sorted[sorted.length - 1];
    if (top.ratings.overall - bottom.ratings.overall > 25) {
      insights.push({ icon: "zap", color: "#8B5CF6", type: "info", title: "Star-Dependent Roster", text: `${top.name} (${top.ratings.overall} OVR) is carrying a heavy load. When opponents key on one player, the offense stalls. Getting ${bottom.name} and others more involved — even in smaller ways — reduces that dependency and makes the whole team harder to gameplan against.` });
    } else if (top.ratings.overall - bottom.ratings.overall <= 10 && players.length >= 3) {
      insights.push({ icon: "trophy", color: "#22C55E", type: "praise", title: "Balanced Roster", text: `Your team has no clear weak link — ratings are within 10 points across the board. That balance makes you extremely hard to scout and defend. Opponents can't key on any single player.` });
    }
  }

  // Team strength + weakness
  const skillKeys = ["shooting", "playmaking", "rebounding", "defense", "efficiency"];
  const skillLabels = { shooting: "Shooting", playmaking: "Playmaking", rebounding: "Rebounding", defense: "Defense", efficiency: "Efficiency" };
  const teamSkills = skillKeys.map((k) => ({ key: k, label: skillLabels[k], val: teamRatings[k] }));
  const strongestTeamSkill = [...teamSkills].sort((a, b) => b.val - a.val)[0];
  const weakestTeamSkill   = [...teamSkills].sort((a, b) => a.val - b.val)[0];

  if (strongestTeamSkill && strongestTeamSkill.val >= 55) {
    insights.push({ icon: "fire", color: "#22C55E", type: "praise", title: `Team Identity: ${strongestTeamSkill.label}`, text: `${strongestTeamSkill.label} is your team's biggest collective strength (${strongestTeamSkill.val}/99). Build your system around this — game plans that emphasize your best skill win more than game plans that try to be everything.` });
  }
  if (weakestTeamSkill && weakestTeamSkill.val < 45 && weakestTeamSkill.val > 0) {
    insights.push({ icon: "zap", color: "#F59E0B", type: "info", title: `Team Gap: ${weakestTeamSkill.label}`, text: `${weakestTeamSkill.label} is your collective weak point at ${weakestTeamSkill.val}/99. Opponents will find this and exploit it — run focused team drills on this skill before your next competition.` });
  }

  return { teamRatings, players, teamSeason, insights: insights.slice(0, 5) };
}
