"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
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

const SCREEN_TO_PATH = {
  home: "/dashboard",
  train: "/training",
  gametime: "/training",
  skills: "/skills",
  shots: "/sessions",
  heatmap: "/heatmap",
  journal: "/journal",
  gamelog: "/game-log",
  iq: "/iq",
};

const PATH_TO_SCREEN = Object.entries(SCREEN_TO_PATH).reduce((acc, [screen, path]) => {
  if (!acc[path]) acc[path] = screen;
  return acc;
}, { "/": "home" });

function screenFromLocation() {
  if (typeof window === "undefined") return "home";
  return PATH_TO_SCREEN[window.location.pathname] || "home";
}

const EMPTY_SHOTS = {
  total: 0, made: 0,
  threes: { total: 0, made: 0 },
  midRange: { total: 0, made: 0 },
  paint: { total: 0, made: 0 },
  freeThrows: { total: 0, made: 0 },
};

export function AppProvider({ children }) {
  const { playerProfile } = useAuth();
  const [screen, setScreen] = useState(screenFromLocation);
  const [previousScreen, setPreviousScreen] = useState("home");

  const navigateTo = useCallback((nextScreen, options = {}) => {
    setPreviousScreen((prev) => (prev !== nextScreen ? screen : prev));
    setScreen(nextScreen);

    if (typeof window !== "undefined") {
      const nextPath = SCREEN_TO_PATH[nextScreen] || "/dashboard";
      if (window.location.pathname !== nextPath) {
        const method = options.replace ? "replaceState" : "pushState";
        window.history[method]({ courtiqScreen: nextScreen }, "", nextPath);
      }
    }
  }, [screen]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    if (window.location.pathname === "/") {
      window.history.replaceState({ courtiqScreen: "home" }, "", "/dashboard");
    }

    const onPopState = () => {
      const nextScreen = screenFromLocation();
      setPreviousScreen(screen);
      setScreen(nextScreen);
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [screen]);

  const [loading, setLoading] = useState(true);

  // Team access remains disabled until ownership and billing are server-verified.
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
    if (!playerId) return;
    setLoading(true);
    try {
      const [shots, trend, zones, journal, team, tInfo, streak] = await Promise.all([
        fetchShotData(playerId),
        fetchWeeklyTrend(playerId),
        fetchHeatZones(playerId),
        fetchJournalEntries(playerId),
        fetchTeamData(playerId),
        fetchTeamInfo(playerId),
        fetchStreak(playerId),
      ]);

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
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  }, [playerId, playerProfile]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const addJournalEntry = async (entry) => {
    if (!playerId) return;
    try {
      const newEntry = await insertJournalEntry(playerId, entry);
      setJournalEntries((prev) => [newEntry, ...prev]);
    } catch (err) {
      console.error("Failed to add journal entry:", err);
    }
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
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
