"use client";

import Icon from "@/components/ui/Icons";
import PlayerInsights from "@/components/dashboard/PlayerInsights";
import CoachDashboard from "./CoachDashboard";
import { useApp } from "@/context/AppContext";

export default function IQScreen() {
  const { loading } = useApp();

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ height: 40, background: "var(--color-muted)", borderRadius: 12, animation: "pulse 1.5s ease-in-out infinite" }} />
        <div style={{ height: 192, background: "var(--color-muted)", borderRadius: 16, animation: "pulse 1.5s ease-in-out infinite" }} />
        <div style={{ height: 128, background: "var(--color-muted)", borderRadius: 16, animation: "pulse 1.5s ease-in-out infinite" }} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <PlayerInsights />
      {/* Coach comparison -- only shows when multiple players exist */}
      <CoachDashboard />
    </div>
  );
}
