"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { calcPct } from "@/lib/utils";
import TabBar from "@/components/ui/TabBar";
import SectionHeader from "@/components/ui/SectionHeader";
import Card from "@/components/ui/Card";
import SectionDivider from "@/components/ui/SectionDivider";
import EmptyState from "@/components/ui/EmptyState";
import SessionHistory from "./SessionHistory";
import Icon from "@/components/ui/Icons";

export default function ShotTracking() {
  const { shotData, loading } = useApp();
  const [mode, setMode] = useState("game");

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ height: 40, background: "var(--color-muted)", borderRadius: 12 }} />
        <div style={{ height: 192, background: "var(--color-muted)", borderRadius: 16 }} />
        <div style={{ height: 80, background: "var(--color-muted)", borderRadius: 16 }} />
        <div style={{ height: 80, background: "var(--color-muted)", borderRadius: 16 }} />
      </div>
    );
  }

  const data = mode === "game" ? shotData.game : shotData.practice;
  const fgPct = calcPct(data.made, data.total);
  const hasShots = data.total > 0;

  const zones = [
    { label: "3-Pointers", ...data.threes, color: "#FF6B35", iconName: "target" },
    { label: "Mid-Range", ...data.midRange, color: "#8B5CF6", iconName: "compass" },
    { label: "Paint", ...data.paint, color: "#22C55E", iconName: "paint" },
    { label: "Free Throws", ...data.freeThrows, color: "#F59E0B", iconName: "target" },
  ];

  const practicePct = calcPct(shotData.practice.made, shotData.practice.total);

  return (
    <div>
      <TabBar
        tabs={[
          { id: "game", label: "Game Shots", icon: <Icon name="trophy" size={16} /> },
          { id: "practice", label: "Practice", icon: <Icon name="zap" size={16} /> },
        ]}
        active={mode}
        onChange={setMode}
      />

      {!hasShots ? (
        <EmptyState
          icon={<Icon name={mode === "game" ? "trophy" : "zap"} size={32} />}
          title={`No ${mode} shots yet`}
          subtitle="Tap the + button to start logging shots"
        />
      ) : (
        <>
          {/* Overall Percentage Ring */}
          <Card style={{ padding: 24, marginBottom: 8, textAlign: "center" }}>
            <div
              style={{
                position: "relative",
                width: 130,
                height: 130,
                margin: "0 auto 16px",
              }}
            >
              <svg
                viewBox="0 0 120 120"
                style={{
                  width: 130,
                  height: 130,
                  transform: "rotate(-90deg)",
                }}
              >
                <circle cx="60" cy="60" r="52" fill="none" stroke="#F0F1F5" strokeWidth="10" />
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke="#FF6B35"
                  strokeWidth="10"
                  strokeDasharray={`${(fgPct / 100) * 327} 327`}
                  strokeLinecap="round"
                  style={{ transition: "all 0.7s ease" }}
                />
              </svg>
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                }}
              >
                <div
                  style={{
                    fontSize: 32,
                    fontWeight: 900,
                    color: "var(--color-text)",
                    lineHeight: 1,
                  }}
                >
                  {fgPct}%
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--color-text-sec)",
                    fontWeight: 600,
                  }}
                >
                  FG%
                </div>
              </div>
            </div>
            <div style={{ fontSize: 14, color: "var(--color-text-sec)" }}>
              <span style={{ fontWeight: 800, color: "var(--color-text)" }}>
                {data.made}
              </span>{" "}
              made out of{" "}
              <span style={{ fontWeight: 800, color: "var(--color-text)" }}>
                {data.total}
              </span>{" "}
              attempts
            </div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                marginTop: 8,
                padding: "4px 12px",
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 700,
                background: mode === "game" ? "#FFF0E8" : "#F3F0FF",
                color: mode === "game" ? "#FF6B35" : "#8B5CF6",
              }}
            >
              <Icon name={mode === "game" ? "trophy" : "zap"} size={14} />
              {mode === "game" ? "Game Stats" : "Practice Stats"}
            </div>
          </Card>

          <SectionDivider />

          {/* Zone Breakdown */}
          <SectionHeader
            icon={<Icon name="map" size={18} color="#FF6B35" />}
            title="Shot Zone Breakdown"
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              marginBottom: 8,
            }}
          >
            {zones.map((z) => {
              const pct = calcPct(z.made, z.total);
              return (
                <Card
                  key={z.label}
                  style={{
                    padding: 14,
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: `${z.color}15`,
                    }}
                  >
                    <Icon name={z.iconName} size={22} color={z.color} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 6,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: "var(--color-text)",
                        }}
                      >
                        {z.label}
                      </span>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 800,
                          color: z.color,
                        }}
                      >
                        {z.total > 0 ? `${pct}%` : "-"}
                      </span>
                    </div>
                    <div
                      style={{
                        height: 6,
                        background: "var(--color-muted)",
                        borderRadius: 3,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          borderRadius: 3,
                          transition: "all 0.5s ease",
                          width: `${pct}%`,
                          background: `linear-gradient(90deg, ${z.color}, ${z.color}AA)`,
                        }}
                      />
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--color-text-sec)",
                        marginTop: 4,
                      }}
                    >
                      {z.made}/{z.total} shots
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          <SectionDivider />

          {/* Practice vs Game Insight */}
          {mode === "game" && shotData.practice.total > 0 && (
            <div
              style={{
                background: "linear-gradient(135deg, #F0F9FF, #E0F2FE)",
                borderRadius: 14,
                padding: 14,
                display: "flex",
                alignItems: "center",
                gap: 10,
                border: "1px solid #BAE6FD",
              }}
            >
              <Icon name="lightbulb" size={22} color="#0369A1" />
              <div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#0369A1",
                  }}
                >
                  Practice vs Game Insight
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "#0284C7",
                    lineHeight: 1.4,
                  }}
                >
                  Your practice FG% is {practicePct}% vs {fgPct}% in games.
                  {practicePct > fgPct
                    ? " Focus on game-speed reps to close the gap!"
                    : " You're clutch under pressure — keep it up!"}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <SectionDivider />

      {/* Session History */}
      <SessionHistory />
    </div>
  );
}
