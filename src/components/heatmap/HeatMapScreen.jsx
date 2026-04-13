"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { getHeatColor } from "@/lib/utils";
import TabBar from "@/components/ui/TabBar";
import SectionHeader from "@/components/ui/SectionHeader";
import Card from "@/components/ui/Card";
import SectionDivider from "@/components/ui/SectionDivider";
import EmptyState from "@/components/ui/EmptyState";
import Icon from "@/components/ui/Icons";

const LEGEND = [
  { label: "Cold", color: "rgba(239, 68, 68, 0.6)" },
  { label: "Warm", color: "rgba(255, 107, 53, 0.55)" },
  { label: "Hot", color: "rgba(34, 197, 94, 0.55)" },
  { label: "Fire", color: "rgba(34, 197, 94, 0.85)" },
];

export default function HeatMapScreen() {
  const { heatZones, loading } = useApp();
  const [selected, setSelected] = useState(null);
  const [mode, setMode] = useState("all");

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div
          style={{
            height: 40,
            background: "var(--color-muted)",
            borderRadius: 12,
          }}
        />
        <div
          style={{
            height: 320,
            background: "var(--color-muted)",
            borderRadius: 16,
          }}
        />
        <div
          style={{
            height: 128,
            background: "var(--color-muted)",
            borderRadius: 16,
          }}
        />
      </div>
    );
  }

  const hasShots = heatZones.some((z) => z.shots > 0);
  const sortedZones = [...heatZones]
    .filter((z) => z.shots > 0)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 5);

  return (
    <div>
      <TabBar
        tabs={[
          { id: "all", label: "All Shots", icon: <Icon name="basketball" size={16} /> },
          { id: "game", label: "Games", icon: <Icon name="trophy" size={16} /> },
          { id: "practice", label: "Practice", icon: <Icon name="zap" size={16} /> },
        ]}
        active={mode}
        onChange={setMode}
      />

      {!hasShots ? (
        <EmptyState
          icon={<Icon name="fire" size={32} />}
          title="No heat map data yet"
          subtitle="Start logging shots to build your heat map and see where you're hot"
        />
      ) : (
        <>
          {/* Court with Heat Zones */}
          <Card style={{ padding: 16, marginBottom: 16 }}>
            <div
              style={{
                position: "relative",
                width: "100%",
                background: "#E8E4D9",
                borderRadius: 14,
                overflow: "hidden",
                border: "2px solid #C4C0B5",
                paddingBottom: "95%",
              }}
            >
              <svg
                viewBox="0 0 500 470"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                }}
              >
                <rect x="25" y="15" width="450" height="440" fill="none" stroke="#D4D0C5" strokeWidth="2" rx="4" />
                <path d="M 60 440 L 60 340 Q 60 100 250 60 Q 440 100 440 340 L 440 440" fill="none" stroke="#C4C0B5" strokeWidth="2" />
                <rect x="160" y="280" width="180" height="175" fill="none" stroke="#C4C0B5" strokeWidth="2" rx="2" />
                <circle cx="250" cy="280" r="60" fill="none" stroke="#C4C0B5" strokeWidth="1.5" strokeDasharray="6 4" />
                <circle cx="250" cy="420" r="8" fill="none" stroke="#C4C0B5" strokeWidth="2" />
                <rect x="220" y="425" width="60" height="3" fill="#C4C0B5" rx="1.5" />
                <path d="M 218 440 Q 218 390 250 380 Q 282 390 282 440" fill="none" stroke="#C4C0B5" strokeWidth="1.5" />
                <line x1="25" y1="15" x2="475" y2="15" stroke="#C4C0B5" strokeWidth="2" />
              </svg>

              {heatZones.map((zone) => {
                const isSelected = selected?.id === zone.id;
                const size = isSelected ? 48 : 36;
                if (zone.shots === 0) return null;
                return (
                  <div
                    key={zone.id}
                    onClick={() => setSelected(isSelected ? null : zone)}
                    style={{
                      position: "absolute",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "50%",
                      transition: "all 0.2s ease",
                      left: `${zone.x}%`,
                      top: `${zone.y}%`,
                      transform: "translate(-50%, -50%)",
                      width: size,
                      height: size,
                      background: getHeatColor(zone.pct),
                      border: isSelected
                        ? "3px solid white"
                        : "2px solid rgba(255,255,255,0.5)",
                      boxShadow: isSelected
                        ? "0 0 20px rgba(0,0,0,0.25)"
                        : "0 2px 8px rgba(0,0,0,0.15)",
                      zIndex: isSelected ? 10 : 1,
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 900,
                        color: "#fff",
                        fontSize: isSelected ? 14 : 11,
                        textShadow: "0 1px 3px rgba(0,0,0,0.3)",
                      }}
                    >
                      {zone.pct}%
                    </span>
                  </div>
                );
              })}
            </div>

            {selected && (
              <div
                style={{
                  marginTop: 12,
                  background: "#F8F9FC",
                  borderRadius: 12,
                  padding: 14,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  border: "1px solid #E8E9F0",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 800,
                      color: "var(--color-text)",
                    }}
                  >
                    {selected.label}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--color-text-sec)",
                    }}
                  >
                    {selected.shots} total shots
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 900,
                    color:
                      selected.pct >= 50
                        ? "#22C55E"
                        : selected.pct >= 40
                        ? "#FF6B35"
                        : "#EF4444",
                  }}
                >
                  {selected.pct}%
                </div>
              </div>
            )}
          </Card>

          {/* Legend */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 16,
              marginBottom: 8,
            }}
          >
            {LEGEND.map((l) => (
              <div
                key={l.label}
                style={{ display: "flex", alignItems: "center", gap: 4 }}
              >
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: l.color,
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--color-text-sec)",
                    fontWeight: 600,
                  }}
                >
                  {l.label}
                </span>
              </div>
            ))}
          </div>

          <SectionDivider />

          {/* Zone Rankings */}
          <SectionHeader
            icon={<Icon name="trophy" size={18} color="#FF6B35" />}
            title="Zone Rankings"
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {sortedZones.map((z, i) => {
              const bgColors = [
                "#FEF3C7",
                "#F3F4F6",
                "#FED7AA",
                "#F8F9FC",
                "#F8F9FC",
              ];
              return (
                <Card
                  key={z.id}
                  style={{
                    padding: "10px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 800,
                      color: "var(--color-text)",
                      background: bgColors[i],
                    }}
                  >
                    {i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "var(--color-text)",
                      }}
                    >
                      {z.label}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: z.pct >= 50 ? "#22C55E" : "#FF6B35",
                    }}
                  >
                    {z.pct}%
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--color-text-sec)",
                    }}
                  >
                    {z.shots}s
                  </span>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
