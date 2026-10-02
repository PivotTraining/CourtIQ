"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { pathForScreen, screenFromPath } from "@/lib/routes";
import { trackEvent } from "@/lib/telemetry";
import {
  fetchShotData,
  fetchWeeklyTrend,
  fetchHeatZones,
  fetchJournalEntries,
  insertJournalEntry,
  fetchTeamData,
  fetchTeamInfo,
  fetchStreak,
} from "@/lib/queries";

const AppContext = createContext(null);

const EMPTY_SHOTS = {
  total: 0, made: 0,
  threes: { total: 0, made: 0 },
  midRange: { total: 0, made: 0 },
  paint: { total: 0, made: 0 },
  freeThrows: { total: 0, made: 0 },
};

export function AppProvider({ children }) {
  const { playerProfile } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const screen = screenFromPath(pathname);
  const [previousScreen, setPreviousScreen] = useState("home");
  const lastScreenRef = useRef(screen);

  useEffect(() => {
    trackEvent("screen_view", { screen });
  }, [screen]);

  useEffect(() => {
    if (lastScreenRef.current !== screen) {
      setPreviousScreen(lastScreenRef.current);
      lastScreenRef.current = screen;
    }
  }, [screen]);

  const navigateTo = useCallback((nextScreen, options = {}) => {
    const nextPath = pathForScreen(nextScreen);
    if (nextPath === pathname) return;
    if (options.replace) router.replace(nextPath);
    else router.push(nextPath);
  }, [pathname, router]);

  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState(null);
  const loadVersion = useRef(0);
  const isTeamIQ = false;

  const [player, setPlayer] = useState(null);
  const [shotData, setShotData] = useState({ game: EMPTY_SHOTS, practice: EMPTY_SHOTS });
  const [weeklyTrend, setWeeklyTrend] = useState([]);
  const [heatZones, setHeatZones] = useState([]);
  const [journalEntries, setJournalEntries] = useState([]);
  const [teamData, setTeamData] = useState([]);
  const [teamInfo, setTeamInfo] = useState({ name: "", season: "", record: "0-0", ppg: "0", fgPct: "0", apg: "0" });

  const playerId = playerProfile?.id;

  const refreshData = useCallback(async () => {
    if (!playerId) return false;
    const version = ++loadVersion.current;
    setLoading(true);
    setDataError(null);
    try {
      const [shots, trend, zones, journal, team, tInfo, streak] = await Promise.all([
        fetchShotData(playerId),
        fetchWeeklyTrend(playerId),
        fetchHeatZones(playerId),
        fetchJournalEntries(playerId),
        isTeamIQ ? fetchTeamData(playerId) : [],
        isTeamIQ ? fetchTeamInfo(playerId) : { name: "", season: "", record: "0-0", ppg: "0", fgPct: "0", apg: "0" },
        fetchStreak(playerId),
      ]);
      if (version !== loadVersion.current) return false;

      setShotData(shots);
      setWeeklyTrend(trend);
      setHeatZones(zones);
      setJournalEntries(journal);
      setTeamData(team);
      setTeamInfo(tInfo);
      setPlayer({
        name: playerProfile.name,
        team: playerProfile.team_name || "",
        number: playerProfile.jersey_number || 0,
        position: playerProfile.position || "",
        age: playerProfile.age || 0,
        avatar: null,
        streak,
      });
      return true;
    } catch (err) {
      console.error("Failed to load data:", err);
      if (version === loadVersion.current) setDataError("Your records couldn't be loaded. They have not been cleared. Check your connection and try again.");
      return false;
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, [playerId, playerProfile]);

  useEffect(() => {
    refreshData();
    return () => { loadVersion.current += 1; };
  }, [refreshData]);

  const addJournalEntry = async (entry) => {
    if (!playerId) throw new Error("Select a player before saving a journal entry.");
    const version = loadVersion.current;
    const newEntry = await insertJournalEntry(playerId, entry);
    if (version === loadVersion.current) setJournalEntries((prev) => [newEntry, ...prev]);
    return newEntry;
  };

  return (
    <AppContext.Provider
      value={{
        screen,
        setScreen: navigateTo,
        previousScreen,
        player,
        shotData,
        weeklyTrend,
        heatZones,
        journalEntries,
        addJournalEntry,
        teamData,
        teamInfo,
        loading,
        refreshData,
        playerId,
        isTeamIQ,
      }}
    >
      {dataError && !player ? (
        <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
          <div style={{ maxWidth: 360 }}>
            <h1 style={{ fontSize: 22, marginBottom: 8 }}>Records unavailable</h1>
            <p role="alert" style={{ color: "var(--color-text-sec)", lineHeight: 1.5 }}>{dataError}</p>
            <button onClick={refreshData} style={{ marginTop: 16, minHeight: 44, padding: "0 24px", border: 0, borderRadius: 12, background: "var(--color-accent)", color: "white", fontWeight: 700 }}>Try again</button>
          </div>
        </main>
      ) : <>
        {dataError && <div role="alert" style={{ padding: 16, background: "var(--color-card)", color: "var(--color-danger)" }}>{dataError} <button onClick={refreshData}>Retry</button></div>}
        {children}
      </>}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
