import { COURT_ZONES, ZONE_CATEGORIES } from "./constants";

const BADGE_DEFS = [
  { id: "first-session", name: "First Step", icon: "basketball", desc: "Log your first session", check: (s) => s.sessions >= 1 },
  { id: "5-sessions", name: "Getting Reps", icon: "refresh", desc: "Complete 5 sessions", check: (s) => s.sessions >= 5 },
  { id: "10-sessions", name: "Consistent", icon: "clock", desc: "Complete 10 sessions", check: (s) => s.sessions >= 10 },
  { id: "25-sessions", name: "Dedicated", icon: "gem", desc: "Complete 25 sessions", check: (s) => s.sessions >= 25 },
  { id: "100-shots", name: "Centurion", icon: "target", desc: "Log 100 total shots", check: (s) => s.totalShots >= 100 },
  { id: "500-shots", name: "Volume Shooter", icon: "target", desc: "Log 500 total shots", check: (s) => s.totalShots >= 500 },
  { id: "3-streak", name: "Hot Streak", icon: "fire", desc: "3-day activity streak", check: (s) => s.streak >= 3 },
  { id: "7-streak", name: "On Fire", icon: "fire", desc: "7-day activity streak", check: (s) => s.streak >= 7 },
  { id: "50-fg", name: "Efficient", icon: "check", desc: "50%+ FG in a game session", check: (s) => s.bestFgPct >= 50 },
  { id: "40-three", name: "Sniper", icon: "star", desc: "40%+ from three (10+ attempts)", check: (s) => s.threePctQualified >= 40 },
  { id: "double-digit", name: "Scorer", icon: "trophy", desc: "Score 10+ points in a game", check: (s) => s.bestPts >= 10 },
  { id: "20-pts", name: "Bucket", icon: "trophy", desc: "Score 20+ points in a game", check: (s) => s.bestPts >= 20 },
  { id: "5-ast", name: "Floor General", icon: "eye", desc: "5+ assists in a game", check: (s) => s.bestAst >= 5 },
  { id: "10-reb", name: "Glass Cleaner", icon: "muscle", desc: "10+ rebounds in a game", check: (s) => s.bestReb >= 10 },
  { id: "first-journal", name: "Reflective", icon: "journal", desc: "Write your first journal entry", check: (s) => s.journalEntries >= 1 },
  { id: "5-journal", name: "Mindful", icon: "brain", desc: "Write 5 journal entries", check: (s) => s.journalEntries >= 5 },
];

export function computeBadges(sessions, streak, journalCount) {
  const gameSessions = sessions.filter((s) => s.type === "game");
  const allShots = sessions.flatMap((s) => s.shot_logs || []);

  // Best game stats
  let bestPts = 0, bestAst = 0, bestReb = 0, bestFgPct = 0, threePctQualified = 0;

  for (const session of gameSessions) {
    const shots = session.shot_logs || [];
    const stats = session.game_stats || {};
    const made = shots.filter((s) => s.made).length;
    const pct = shots.length > 0 ? Math.round((made / shots.length) * 100) : 0;
    const pts = shots.filter((s) => s.made).reduce((sum, s) => {
      const zone = COURT_ZONES.find((z) => z.id === s.zone_id);
      return sum + (zone?.pts || 2);
    }, 0) + (stats.ft_made || 0);

    bestPts = Math.max(bestPts, pts);
    bestAst = Math.max(bestAst, stats.ast || 0);
    bestReb = Math.max(bestReb, stats.reb || 0);
    if (shots.length >= 5) bestFgPct = Math.max(bestFgPct, pct);

    // 3PT qualified
    const threes = shots.filter((s) => ZONE_CATEGORIES.threes.includes(s.zone_id));
    if (threes.length >= 10) {
      const threePct = Math.round((threes.filter((s) => s.made).length / threes.length) * 100);
      threePctQualified = Math.max(threePctQualified, threePct);
    }
  }

  const context = {
    sessions: sessions.length,
    totalShots: allShots.length,
    streak,
    bestFgPct,
    threePctQualified,
    bestPts,
    bestAst,
    bestReb,
    journalEntries: journalCount,
  };

  const earned = [];
  const locked = [];

  for (const badge of BADGE_DEFS) {
    if (badge.check(context)) {
      earned.push(badge);
    } else {
      locked.push(badge);
    }
  }

  return { earned, locked, total: BADGE_DEFS.length };
}
