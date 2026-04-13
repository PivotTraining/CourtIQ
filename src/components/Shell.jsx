"use client";

import { useRef, useEffect, useState } from "react";
import { useApp } from "@/context/AppContext";
import BottomNav from "./BottomNav";
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
import ProUpgradeScreen from "./pro/ProUpgradeScreen";
import ParentChildLink from "./pro/ParentChildLink";
import Icon from "./ui/Icons";
import { getGreeting } from "@/lib/utils";
import { signOutUser } from "@/lib/firebase";

const TITLES = {
  home: null, // show logo instead
  train: "Track Stats",
  gametime: "Gametime",
  skills: "Skills",
  iq: "My IQ",
  shots: "Sessions",
  heatmap: "Heat Map",
  journal: "Journal",
  gamelog: "Game Log",
  "pro-upgrade": "Court IQ Pro",
};

export default function Shell() {
  const { screen, setScreen: navTo, player, refreshData, isPro } = useApp();
  const scrollRef = useRef(null);
  const [showLogger, setShowLogger] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showLinkAccount, setShowLinkAccount] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("courtiq-theme");
      if (saved) return saved === "dark";
      return true; // default to dark mode
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

  // Screen transition
  useEffect(() => {
    if (screen !== displayScreen) {
      setTransitioning(true);
      const t = setTimeout(() => { setDisplayScreen(screen); setTransitioning(false); }, 150);
      return () => clearTimeout(t);
    }
  }, [screen, displayScreen]);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; }, [displayScreen]);

  // Dark mode
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("courtiq-theme", darkMode ? "dark" : "light");
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = darkMode ? "#0F1117" : "#FF6B35";
  }, [darkMode]);

  // Close profile menu on outside click
  useEffect(() => {
    if (!showProfileMenu) return;
    const close = () => setShowProfileMenu(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [showProfileMenu]);

  const renderScreen = () => {
    switch (displayScreen) {
      case "home": return <HomeDashboard />;
      case "train": return <TrainScreen />;
      case "gametime": return <TrainScreen />;
      case "skills": return <SkillsScreen />;
      case "iq": return isPro ? <IQScreen /> : <ProUpgradeScreen featureName="Advanced IQ & Radar Chart" />;
      case "shots": return <ShotTracking />;
      case "heatmap": return isPro ? <HeatMapScreen /> : <ProUpgradeScreen featureName="Heat Map" />;
      case "journal": return <JournalScreen />;
      case "gamelog": return <GameLogScreen />;
      case "pro-upgrade": return <ProUpgradeScreen />;
      default: return <HomeDashboard />;
    }
  };

  return (
    <div style={{ width: "100%", minHeight: "100vh", minHeight: "100dvh", background: "var(--color-bg)", position: "fixed", top: 0, left: 0, right: 0, bottom: 0, overflowX: "hidden", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ width: "100%", maxWidth: 520, margin: "0 auto", position: "relative", flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* ═══ HEADER ═══ */}
        <header style={{
          position: "sticky", top: 0, zIndex: 50,
          background: isPro ? "#0A2A1F" : "var(--color-bg)",
          paddingTop: "max(12px, env(safe-area-inset-top, 12px))",
          paddingLeft: 20, paddingRight: 20, paddingBottom: 8,
          borderBottom: isPro ? "1px solid rgba(34,197,94,0.2)" : "1px solid var(--color-border)",
          transition: "background 0.4s ease",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            {/* Left: back + title or logo */}
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
                  /* Greeting on home — logo moved to dashboard */
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 18, fontWeight: 800, color: isPro ? "#22C55E" : "var(--color-text)", letterSpacing: -0.3 }}>Court IQ</span>
                    {isPro && (
                      <span style={{
                        fontSize: 9, fontWeight: 800, color: "#22C55E",
                        background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)",
                        borderRadius: 6, padding: "2px 6px", letterSpacing: 1, textTransform: "uppercase",
                      }}>
                        PRO
                      </span>
                    )}
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <h1 style={{ fontSize: 18, fontWeight: 800, color: isPro ? "#22C55E" : "var(--color-text)", margin: 0, letterSpacing: -0.3 }}>
                      {TITLES[screen] || "Court IQ"}
                    </h1>
                    {isPro && (
                      <span style={{
                        fontSize: 9, fontWeight: 800, color: "#22C55E",
                        background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)",
                        borderRadius: 6, padding: "2px 6px", letterSpacing: 1, textTransform: "uppercase",
                      }}>
                        PRO
                      </span>
                    )}
                  </div>
                )}
                {isHome && player && (
                  <button onClick={() => setShowSwitcher(true)} style={{
                    fontSize: 12, color: isPro ? "rgba(34,197,94,0.7)" : "var(--color-text-sec)", margin: 0, background: "none",
                    border: "none", cursor: "pointer", textAlign: "left", padding: 0,
                    display: "flex", alignItems: "center", gap: 4, minHeight: 24, marginTop: 2,
                  }}>
                    {getGreeting()}, {player.name.split(" ")[0]}!
                    <Icon name="chevDown" size={10} color={isPro ? "#22C55E" : "var(--color-accent)"} />
                  </button>
                )}
              </div>
            </div>

            {/* Right: actions */}
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

              {/* Profile button with dropdown */}
              <div style={{ position: "relative" }}>
                <button onClick={(e) => { e.stopPropagation(); setShowProfileMenu(!showProfileMenu); }} style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 34, height: 34, borderRadius: 10,
                  background: "linear-gradient(135deg, #FF6B35, #E85A2A)",
                  border: "none", cursor: "pointer", color: "white", fontSize: 11, fontWeight: 800,
                }} aria-label="Profile menu">
                  {player?.name?.split(" ").map((n) => n[0]).join("") || "?"}
                </button>

                {/* Dropdown menu */}
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
                    {isPro ? (
                      <button onClick={() => { setShowProfileMenu(false); setShowLinkAccount(true); }} style={{
                        display: "flex", alignItems: "center", gap: 10, width: "100%",
                        padding: "12px 16px", background: "none", border: "none",
                        cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#22C55E",
                        textAlign: "left", borderTop: "1px solid var(--color-border)",
                      }}>
                        <Icon name="user" size={16} color="#22C55E" /> Link Account
                      </button>
                    ) : (
                      <button onClick={() => { setShowProfileMenu(false); navTo("pro-upgrade"); }} style={{
                        display: "flex", alignItems: "center", gap: 10, width: "100%",
                        padding: "12px 16px", background: "none", border: "none",
                        cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#22C55E",
                        textAlign: "left", borderTop: "1px solid var(--color-border)",
                      }}>
                        <Icon name="star" size={16} color="#22C55E" /> Upgrade to Pro
                      </button>
                    )}
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

        {/* ═══ CONTENT ═══ */}
        <main ref={scrollRef} style={{
          flex: 1, padding: "16px 20px 120px", overflowX: "hidden", overflowY: "auto", WebkitOverflowScrolling: "touch",
          opacity: transitioning ? 0 : 1,
          transform: transitioning ? "translateY(6px)" : "translateY(0)",
          transition: "opacity 0.15s ease, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}>
          {renderScreen()}
        </main>
      </div>

      {/* ═══ FAB — New Session ═══ */}
      <button
        onClick={() => { console.log("FAB clicked"); setShowLogger(true); }}
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

      <BottomNav />

      {/* ═══ MODALS ═══ */}
      {showLogger && <ShotLogger onClose={() => setShowLogger(false)} />}
      {showProfile && <ProfileEditor onClose={() => setShowProfile(false)} />}
      {showSwitcher && <PlayerSwitcher onClose={() => setShowSwitcher(false)} onSwitch={() => refreshData()} />}
      {showLinkAccount && <ParentChildLink onClose={() => setShowLinkAccount(false)} />}
    </div>
  );
}
