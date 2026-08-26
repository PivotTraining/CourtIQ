"use client";

import { useApp } from "@/context/AppContext";
import Icon from "@/components/ui/Icons";

const NAV_ITEMS = [
  { id: "home", icon: "home", label: "Dashboard", description: "Overview & progress" },
  { id: "train", icon: "dumbbell", label: "Training", description: "Drills & workouts" },
  { id: "skills", icon: "skills", label: "Skills", description: "Skill development" },
  { id: "shots", icon: "target", label: "Sessions", description: "Shot sessions" },
  { id: "heatmap", icon: "map", label: "Heat Map", description: "Shooting zones" },
  { id: "gamelog", icon: "trophy", label: "Game Log", description: "Games & performance" },
  { id: "journal", icon: "journal", label: "Journal", description: "Reflection & notes" },
  { id: "iq", icon: "brain", label: "My IQ", description: "Insights & analytics" },
];

export default function DesktopNav({ onStartSession }) {
  const { screen, setScreen, player } = useApp();

  return (
    <aside className="courtiq-desktop-nav" aria-label="Court IQ navigation">
      <div className="courtiq-desktop-brand">
        <img src="/logo.svg" alt="" width="42" height="42" />
        <div>
          <div className="courtiq-desktop-brand-name">Court IQ</div>
          <div className="courtiq-desktop-brand-sub">Player Development</div>
        </div>
      </div>

      <div className="courtiq-desktop-player">
        <div className="courtiq-desktop-avatar">
          {player?.name?.split(" ").map((part) => part[0]).join("").slice(0, 2) || "CI"}
        </div>
        <div className="courtiq-desktop-player-copy">
          <strong>{player?.name || "Player"}</strong>
          <span>{player?.position || "Basketball athlete"}{player?.team ? ` · ${player.team}` : ""}</span>
        </div>
      </div>

      <nav className="courtiq-desktop-nav-list">
        {NAV_ITEMS.map((item) => {
          const active = screen === item.id || (screen === "gametime" && item.id === "train");
          return (
            <button
              key={item.id}
              type="button"
              className={`courtiq-desktop-nav-item${active ? " is-active" : ""}`}
              onClick={() => setScreen(item.id)}
              aria-current={active ? "page" : undefined}
            >
              <span className="courtiq-desktop-nav-icon">
                <Icon name={item.icon} size={19} color={active ? "#FF6B35" : "var(--color-text-sec)"} />
              </span>
              <span className="courtiq-desktop-nav-copy">
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </span>
            </button>
          );
        })}
      </nav>

      <button type="button" className="courtiq-desktop-session" onClick={onStartSession}>
        <Icon name="plus" size={18} color="white" />
        Start a session
      </button>

      <div className="courtiq-desktop-footer">Track the work. Read the game. Get better.</div>
    </aside>
  );
}
