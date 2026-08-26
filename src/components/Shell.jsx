"use client";

import { useRef, useEffect, useState } from "react";
import { useApp } from "@/context/AppContext";
import BottomNav from "./BottomNav";
import DesktopNav from "./DesktopNav";
import HomeDashboard from "./dashboard/HomeDashboard";
import ShotTracking from "./shots/ShotTracking";
import HeatMapScreen from "./heatmap/HeatMapScreen";
import JournalScreen from "./journal/JournalScreen";
import TrainScreen from "./train/TrainScreen";
import SkillsScreen from "./train/SkillsScreen";
import IQScreen from "./iq/IQScreen";
import ShotLogger from "./shots/ShotLogger";
import ProfileEditor from "./auth/ProfileEditor";
import PlayerSwitcher from "./PlayerSwitcher";
import GameLogScreen from "./gamelog/GameLogScreen";
import Icon from "./ui/Icons";
import { getGreeting } from "@/lib/utils";
import { signOutUser } from "@/lib/firebase";

const TITLES = {
  home: null,
  train: "Drills",
  gametime: "Drills",
  skills: "Skills",
  iq: "My IQ",
  shots: "Sessions",
  heatmap: "Heat Map",
  journal: "Journal",
  gamelog: "Game Log",
};

export default function Shell() {
  const { screen, setScreen: navTo, player, refreshData, isTeamIQ } = useApp();
  const scrollRef = useRef(null);
  const [showLogger, setShowLogger] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("courtiq-theme");
      if (saved) return saved === "dark";
      return true;
    }
    return true;
  });
  const [transitioning, setTransitioning] = useState(false);
  const [displayScreen, setDisplayScreen] = useState(screen);

  const isHome = screen === "home";

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  };

  const handleLogout = async () => {
    setShowProfileMenu(false);
    try { await signOutUser(); } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (screen !== displayScreen) {
      setTransitioning(true);
      const t = setTimeout(() => { setDisplayScreen(screen); setTransitioning(false); }, 150);
      return () => clearTimeout(t);
    }
  }, [screen, displayScreen]);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; }, [displayScreen]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("courtiq-theme", darkMode ? "dark" : "light");
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = darkMode ? "#0F1117" : "#FF6B35";
  }, [darkMode]);

  useEffect(() => {
    if (!showProfileMenu) return;
    const close = () => setShowProfileMenu(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [showProfileMenu]);

  const renderScreen = () => {
    switch (displayScreen) {
      case "home": return <HomeDashboard />;
      case "train":
      case "gametime": return <TrainScreen />;
      case "skills": return <SkillsScreen />;
      case "iq": return <IQScreen />;
      case "shots": return <ShotTracking />;
      case "heatmap": return <HeatMapScreen />;
      case "journal": return <JournalScreen />;
      case "gamelog": return <GameLogScreen />;
      default: return <HomeDashboard />;
    }
  };

  const showFab = displayScreen !== "iq";

  return (
    <div className="courtiq-shell-root" style={{ width: "100%", minHeight: "100vh", minHeight: "100dvh", background: "var(--color-bg)", position: "fixed", top: 0, left: 0, right: 0, bottom: 0, overflowX: "hidden", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <DesktopNav onStartSession={() => setShowLogger(true)} />

      <div className="courtiq-shell-main" style={{ width: "100%", maxWidth: 520, margin: "0 auto", position: "relative", flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <header className="courtiq-shell-header" style={{
          position: "sticky", top: 0, zIndex: 50,
          background: isTeamIQ ? "#0F0A2A" : "var(--color-bg)",
          paddingTop: "max(12px, env(safe-area-inset-top, 12px))",
          paddingLeft: 20, paddingRight: 20, paddingBottom: 8,
          borderBottom: isTeamIQ ? "1px solid rgba(139,92,246,0.25)" : "1px solid var(--color-border)",
          transition: "background 0.4s ease",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
              {!isHome && (
                <button onClick={() => navTo("home")} style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 36, height: 36, borderRadius: 10,
                  background: "var(--color-muted)", border: "none", cursor: "pointer", flexShrink: 0,
                }} aria-label="Back">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-text)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
              <div style={{ minWidth: 0 }}>
                {isHome ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 18, fontWeight: 800, color: isTeamIQ ? "#8B5CF6" : "var(--color-text)", letterSpacing: -0.3 }}>Court IQ</span>
                    {isTeamIQ ? (
                      <span style={{ fontSize: 9, fontWeight: 800, color: "#8B5CF6", background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)", borderRadius: 6, padding: "2px 6px", letterSpacing: 1, textTransform: "uppercase" }}>TEAM</span>
                    ) : null}
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <h1 style={{ fontSize: 18, fontWeight: 800, color: isTeamIQ ? "#8B5CF6" : "var(--color-text)", margin: 0, letterSpacing: -0.3 }}>
                      {TITLES[screen] || "Court IQ"}
                    </h1>
                    {isTeamIQ ? (
                      <span style={{ fontSize: 9, fontWeight: 800, color: "#8B5CF6", background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)", borderRadius: 6, padding: "2px 6px", letterSpacing: 1, textTransform: "uppercase" }}>TEAM</span>
                    ) : null}
                  </div>
                )}
                {isHome && player && (
                  <button onClick={() => setShowSwitcher(true)} style={{
                    fontSize: 12, color: isTeamIQ ? "rgba(139,92,246,0.7)" : "var(--color-text-sec)", margin: 0, background: "none",
                    border: "none", cursor: "pointer", textAlign: "left", padding: 0,
                    display: "flex", alignItems: "center", gap: 4, minHeight: 24, marginTop: 2,
                  }}>
                    {getGreeting()}, {player.name.split(" ")[0]}!
                    <Icon name="chevDown" size={10} color={isTeamIQ ? "#8B5CF6" : "var(--color-accent)"} />
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <button onClick={() => setDarkMode(!darkMode)} style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 34, height: 34, borderRadius: 10,
                background: "var(--color-muted)", border: "none", cursor: "pointer",
              }} aria-label="Theme">
                <Icon name={darkMode ? "sun" : "moon"} size={15} />
              </button>
              <button onClick={handleRefresh} disabled={refreshing} style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 34, height: 34, borderRadius: 10,
                background: "var(--color-muted)", border: "none", cursor: "pointer",
                opacity: refreshing ? 0.5 : 1,
              }} aria-label="Refresh">
                <Icon name="refresh" size={15} />
              </button>

              <div style={{ position: "relative" }}>
                <button onClick={(e) => { e.stopPropagation(); setShowProfileMenu(!showProfileMenu); }} style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 34, height: 34, borderRadius: 10,
                  background: "linear-gradient(135deg, #FF6B35, #E85A2A)",
                  border: "none", cursor: "pointer", color: "white", fontSize: 11, fontWeight: 800,
                }} aria-label="Profile menu">
                  {player?.name?.split(" ").map((n) => n[0]).join("") || "?"}
                </button>

                {showProfileMenu && (
                  <div style={{
                    position: "absolute", top: 42, right: 0, zIndex: 100,
                    background: "var(--color-card)", borderRadius: 12,
                    border: "1px solid var(--color-border)",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
                    minWidth: 180, overflow: "hidden",
                  }}>
                    <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--color-border)" }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)" }}>{player?.name || "Player"}</div>
                      <div style={{ fontSize: 11, color: "var(--color-text-sec)", marginTop: 2 }}>{player?.position} {player?.team ? `· ${player.team}` : ""}</div>
                    </div>
                    <button onClick={() => { setShowProfileMenu(false); setShowProfile(true); }} style={{
                      display: "flex", alignItems: "center", gap: 10, width: "100%",
                      padding: "12px 16px", background: "none", border: "none",
                      cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--color-text)",
                      textAlign: "left",
                    }}>
                      <Icon name="user" size={16} color="var(--color-text-sec)" /> Edit Profile
                    </button>
                    <button onClick={handleLogout} style={{
                      display: "flex", alignItems: "center", gap: 10, width: "100%",
                      padding: "12px 16px", background: "none", border: "none",
                      cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#EF4444",
                      textAlign: "left", borderTop: "1px solid var(--color-border)",
                    }}>
                      <Icon name="x" size={16} color="#EF4444" /> Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main ref={scrollRef} className="courtiq-shell-content" style={{
          flex: 1, padding: "16px 20px 120px", overflowX: "hidden", overflowY: "auto", WebkitOverflowScrolling: "touch",
          opacity: transitioning ? 0 : 1,
          transform: transitioning ? "translateY(6px)" : "translateY(0)",
          transition: "opacity 0.15s ease, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}>
          {renderScreen()}
        </main>
      </div>

      {showFab && (
        <button
          className="courtiq-mobile-fab"
          onClick={() => setShowLogger(true)}
          style={{
            position: "fixed", zIndex: 200, bottom: 96, right: 20,
            width: 56, height: 56, borderRadius: 28,
            background: "#FF6B35", color: "white", border: "none",
            cursor: "pointer", fontSize: 28, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 8px 32px rgba(255,107,53,0.4)",
            WebkitTapHighlightColor: "transparent",
          }}
          aria-label="Start Gametime"
        >
          <Icon name="plus" size={24} color="white" />
        </button>
      )}

      <BottomNav />

      {showLogger && <ShotLogger onClose={() => setShowLogger(false)} />}
      {showProfile && <ProfileEditor onClose={() => setShowProfile(false)} />}
      {showSwitcher && <PlayerSwitcher onClose={() => setShowSwitcher(false)} onSwitch={() => refreshData()} />}
    </div>
  );
}
