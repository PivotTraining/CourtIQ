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

export async function createSession(playerId, type, mode = "individual") {
  const { data, error } = await getSupabase()
    .from("sessions")
    .insert({ player_id: playerId, type, mode })
    .select()
    .single();
  if (error) throw error;
  return data;
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
    .select("role, player_id, players(id, name)")
    .eq("team_id", membership.team_id);

  return (members || []).map((m) => ({
    name: m.players?.name || "Unknown",
    pts: 0,
    ast: 0,
    reb: 0,
    fgPct: 0,
    role: m.role || "",
    isUser: m.player_id === playerId,
  }));
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
