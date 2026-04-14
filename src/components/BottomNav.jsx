"use client";

import { useApp } from "@/context/AppContext";
import Icon from "@/components/ui/Icons";

const NAV_ITEMS = [
  { id: "home", icon: "home", label: "Home" },
  { id: "train", icon: "dumbbell", label: "Drills" },
  { id: "skills", icon: "skills", label: "Skills" },
  { id: "iq", icon: "brain", label: "My IQ" },
  { id: "gamelog", icon: "trophy", label: "Game Log" },
];

function haptic() {
  if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(10);
}

export default function BottomNav() {
  const { screen, setScreen } = useApp();

  return (
    <nav
      role="tablist"
      aria-label="Main navigation"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        background: "var(--color-card)",
        borderTop: "1px solid var(--color-border)",
        boxShadow: "0 -2px 12px rgba(0,0,0,0.04)",
      }}
    >
      <div
        style={{
          maxWidth: 520,
          margin: "0 auto",
          display: "flex",
          justifyContent: "space-around",
          paddingTop: 8,
          paddingBottom: "env(safe-area-inset-bottom, 8px)",
        }}
      >
        {NAV_ITEMS.map((item) => {
          const isActive = screen === item.id;
          return (
            <button
              key={item.id}
              role="tab"
              aria-selected={isActive}
              aria-label={item.label}
              onClick={() => { haptic(); setScreen(item.id); }}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                gap: 2,
                minWidth: 48,
                minHeight: 48,
                padding: "4px 8px",
              }}
            >
              <Icon
                name={item.icon}
                size={22}
                color={isActive ? "var(--color-accent)" : "var(--color-text-sec)"}
                style={{
                  transition: "all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
                  transform: isActive ? "scale(1.15)" : "scale(1)",
                }}
              />
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  color: isActive ? "var(--color-accent)" : "var(--color-text-sec)",
                  transition: "color 0.15s ease",
                }}
              >
                {item.label}
              </span>
              {isActive && (
                <div style={{ width: 4, height: 4, borderRadius: 2, background: "var(--color-accent)", marginTop: -2 }} />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
