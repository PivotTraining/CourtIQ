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

const EMPTY_SHOTS = {
  total: 0, made: 0,
  threes: { total: 0, made: 0 },
  midRange: { total: 0, made: 0 },
  paint: { total: 0, made: 0 },
  freeThrows: { total: 0, made: 0 },
};

export function AppProvider({ children }) {
  const { playerProfile } = useAuth();
  const [screen, setScreen] = useState("home");
  const [loading, setLoading] = useState(true);

  const [isPro, setIsPro] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("courtiq-pro") === "true";
    }
    return false;
  });
  const upgradeToPro = () => {
    setIsPro(true);
    localStorage.setItem("courtiq-pro", "true");
  };

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
        setScreen,
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
        isPro,
        upgradeToPro,
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
