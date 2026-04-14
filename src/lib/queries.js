import { getSupabase } from "./supabase";
import { COURT_ZONES, ZONE_CATEGORIES } from "./constants";

// ─── PLAYER ───

export async function fetchPlayerProfile(firebaseUid) {
  const { data } = await getSupabase()
    .from("players")
    .select("*")
    .eq("firebase_uid", firebaseUid)
    .single();
  return data;
}

export async function createPlayerProfile(profile) {
  const { data, error } = await getSupabase()
    .from("players")
    .insert({ ...profile, manager_uid: profile.firebase_uid })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── MULTI-PLAYER ───

export async function fetchManagedPlayers(firebaseUid) {
  const { data } = await getSupabase()
    .from("players")
    .select("*")
    .eq("manager_uid", firebaseUid)
    .order("created_at", { ascending: true });
  return data || [];
}

export async function addManagedPlayer(firebaseUid, player) {
  const { data, error } = await getSupabase()
    .from("players")
    .insert({
      firebase_uid: `${firebaseUid}_${Date.now()}`, // unique per managed player
      manager_uid: firebaseUid,
      name: player.name,
      team_name: player.team_name || null,
      position: player.position || "PG",
      jersey_number: player.jersey_number || null,
      age: player.age || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteManagedPlayer(playerId) {
  // Delete all associated data first
  await getSupabase().from("shot_logs").delete().eq("player_id", playerId);
  await getSupabase().from("journal_entries").delete().eq("player_id", playerId);
  await getSupabase().from("sessions").delete().eq("player_id", playerId);
  const { error } = await getSupabase().from("players").delete().eq("id", playerId);
  if (error) throw error;
}

// ─── SHOT DATA (aggregated by game/practice) ───

export async function fetchShotData(playerId) {
  const { data: shots } = await getSupabase()
    .from("shot_logs")
    .select("zone_id, made, sessions(type)")
    .eq("player_id", playerId);

  const empty = { total: 0, made: 0, threes: { total: 0, made: 0 }, midRange: { total: 0, made: 0 }, paint: { total: 0, made: 0 }, freeThrows: { total: 0, made: 0 } };
  const result = {
    game: JSON.parse(JSON.stringify(empty)),
    practice: JSON.parse(JSON.stringify(empty)),
  };

  if (!shots) return result;

  for (const shot of shots) {
    const type = shot.sessions?.type || "practice";
    const bucket = result[type];
    if (!bucket) continue;

    bucket.total++;
    if (shot.made) bucket.made++;

    const zone = COURT_ZONES.find((z) => z.id === shot.zone_id);
    const cat = zone?.category || "midRange";
    bucket[cat].total++;
    if (shot.made) bucket[cat].made++;
  }

  return result;
}

// ─── WEEKLY TREND ───

export async function fetchWeeklyTrend(playerId) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 6);

  const { data: shots } = await getSupabase()
    .from("shot_logs")
    .select("made, created_at")
    .eq("player_id", playerId)
    .gte("created_at", weekAgo.toISOString());

  const dayMap = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekAgo);
    d.setDate(d.getDate() + i);
    const key = d.toDateString();
    dayMap[key] = { day: days[d.getDay()], total: 0, made: 0 };
  }

  if (shots) {
    for (const shot of shots) {
      const key = new Date(shot.created_at).toDateString();
      if (dayMap[key]) {
        dayMap[key].total++;
        if (shot.made) dayMap[key].made++;
      }
    }
  }

  return Object.values(dayMap).map((d) => ({
    day: d.day,
    pct: d.total > 0 ? Math.round((d.made / d.total) * 100) : 0,
    shots: d.total,
  }));
}

// ─── HEAT ZONES ───

export async function fetchHeatZones(playerId) {
  const { data: shots } = await getSupabase()
    .from("shot_logs")
    .select("zone_id, made")
    .eq("player_id", playerId);

  const zoneStats = {};
  if (shots) {
    for (const shot of shots) {
      if (!zoneStats[shot.zone_id]) {
        zoneStats[shot.zone_id] = { total: 0, made: 0 };
      }
      zoneStats[shot.zone_id].total++;
      if (shot.made) zoneStats[shot.zone_id].made++;
    }
  }

  return COURT_ZONES.map((zone) => {
    const stats = zoneStats[zone.id] || { total: 0, made: 0 };
    return {
      ...zone,
      pct: stats.total > 0 ? Math.round((stats.made / stats.total) * 100) : 0,
      shots: stats.total,
    };
  });
}

// ─── JOURNAL ───

export async function fetchJournalEntries(playerId) {
  const { data } = await getSupabase()
    .from("journal_entries")
    .select("*")
    .eq("player_id", playerId)
    .order("created_at", { ascending: false });

  return (data || []).map((e) => ({
    id: e.id,
    date: new Date(e.created_at).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    type: e.type,
    mood: e.mood,
    title: e.title,
    body: e.body,
    stats: e.stats || {},
  }));
}

export async function insertJournalEntry(playerId, entry) {
  const { data, error } = await getSupabase()
    .from("journal_entries")
    .insert({
      player_id: playerId,
      type: entry.type,
      mood: entry.mood,
      title: entry.title,
      body: entry.body,
      stats: entry.stats || {},
    })
    .select()
    .single();
  if (error) throw error;
  return {
    id: data.id,
    date: new Date(data.created_at).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    type: data.type,
    mood: data.mood,
    title: data.title,
    body: data.body,
    stats: data.stats || {},
  };
}

// ─── SESSIONS + SHOTS ───

// 6-char join code: no I, O, 0, 1 to avoid visual confusion
function makeJoinCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export async function createSession(playerId, type, mode = "individual") {
  const initialStats = mode === "team" ? { join_code: makeJoinCode() } : null;
  const { data, error } = await getSupabase()
    .from("sessions")
    .insert({ player_id: playerId, type, mode, ...(initialStats ? { game_stats: initialStats } : {}) })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Find a live session by its 6-char join code (created within the last 18 hours).
// Uses PostgREST JSONB text extraction filter: game_stats->>join_code
export async function findSessionByJoinCode(code) {
  const cutoff = new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString();
  const { data } = await getSupabase()
    .from("sessions")
    .select("*")
    .gte("created_at", cutoff)
    .filter("game_stats->>join_code", "eq", code.toUpperCase().trim())
    .limit(1)
    .maybeSingle();
  return data || null;
}

export async function updateSessionStats(sessionId, gameStats) {
  const { error } = await getSupabase()
    .from("sessions")
    .update({ game_stats: gameStats })
    .eq("id", sessionId);
  if (error) throw error;
}

export async function fetchSessionHistory(playerId) {
  const { data } = await getSupabase()
    .from("sessions")
    .select("*, shot_logs(id, zone_id, made)")
    .eq("player_id", playerId)
    .order("created_at", { ascending: false })
    .limit(50);
  return data || [];
}

export async function insertShot(sessionId, playerId, zoneId, made) {
  const { data, error } = await getSupabase()
    .from("shot_logs")
    .insert({ session_id: sessionId, player_id: playerId, zone_id: zoneId, made })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteShot(shotId) {
  const { error } = await getSupabase()
    .from("shot_logs")
    .delete()
    .eq("id", shotId);
  if (error) throw error;
}

// ─── TEAM ───

export async function fetchTeamData(playerId) {
  const { data: membership } = await getSupabase()
    .from("team_members")
    .select("team_id")
    .eq("player_id", playerId)
    .limit(1)
    .single();

  if (!membership) return [];

  const { data: members } = await getSupabase()
    .from("team_members")
    .select("role, player_id, players(id, name, position, jersey_number)")
    .eq("team_id", membership.team_id);

  if (!members || members.length === 0) return [];

  // Aggregate real game stats for each team member from their sessions
  const enriched = await Promise.all(
    members.map(async (m) => {
      const pid = m.player_id;
      const { data: sessions } = await getSupabase()
        .from("sessions")
        .select("game_stats, shot_logs(made)")
        .eq("player_id", pid)
        .eq("type", "game")
        .limit(25);

      const games = sessions || [];
      const gamesPlayed = Math.max(games.length, 1);
      const allStats = games.map((s) => s.game_stats || {});
      const allShots = games.flatMap((s) => s.shot_logs || []);

      const totalPts = allStats.reduce((s, g) => s + (g.pts || 0), 0);
      const totalAst = allStats.reduce((s, g) => s + (g.ast || 0), 0);
      const totalReb = allStats.reduce((s, g) => s + (g.reb || 0), 0);
      const fgMade   = allShots.filter((sh) => sh.made).length;
      const fgTotal  = allShots.length;

      return {
        id: pid,
        name: m.players?.name || "Unknown",
        position: m.players?.position || "",
        jersey: m.players?.jersey_number || 0,
        pts: gamesPlayed > 0 ? (totalPts / gamesPlayed).toFixed(1) : "0",
        ast: gamesPlayed > 0 ? (totalAst / gamesPlayed).toFixed(1) : "0",
        reb: gamesPlayed > 0 ? (totalReb / gamesPlayed).toFixed(1) : "0",
        fgPct: fgTotal > 0 ? Math.round((fgMade / fgTotal) * 100) : 0,
        gamesPlayed: games.length,
        role: m.role || "",
        isUser: pid === playerId,
      };
    })
  );

  return enriched;
}

export async function fetchTeamInfo(playerId) {
  const { data: membership } = await getSupabase()
    .from("team_members")
    .select("team_id, teams(name, season)")
    .eq("player_id", playerId)
    .limit(1)
    .single();

  if (!membership?.teams) {
    return { name: "", season: "", record: "0-0", ppg: "0", fgPct: "0", apg: "0" };
  }

  return {
    name: membership.teams.name,
    season: membership.teams.season || "",
    record: "0-0",
    ppg: "0",
    fgPct: "0",
    apg: "0",
  };
}

// ─── STREAK ───

export async function fetchStreak(playerId) {
  const { data: sessions } = await getSupabase()
    .from("sessions")
    .select("date")
    .eq("player_id", playerId)
    .order("date", { ascending: false });

  if (!sessions || sessions.length === 0) return 0;

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dates = [...new Set(sessions.map((s) => s.date))].sort().reverse();

  for (let i = 0; i < dates.length; i++) {
    const expected = new Date(today);
    expected.setDate(expected.getDate() - i);
    const expectedStr = expected.toISOString().split("T")[0];
    if (dates[i] === expectedStr) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}
