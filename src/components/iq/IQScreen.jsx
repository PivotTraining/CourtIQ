"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import PlayerInsights from "@/components/dashboard/PlayerInsights";
import AICoach from "./AICoach";
import CoachDashboard from "./CoachDashboard";
import TeamIQScreen from "./TeamIQScreen";
import { useApp } from "@/context/AppContext";

const PremiumAnalytics = dynamic(() => import("./PremiumAnalytics"));

export default function IQScreen() {
  const { loading, isTeamIQ, playerId, player } = useApp();
  const [panel, setPanel] = useState("player");
  const premiumEnabled = process.env.NEXT_PUBLIC_COURTIQ_PREMIUM_ANALYTICS_ENABLED === "true";

  if (loading) return (
    <div role="status" aria-label="Loading player intelligence" style={{ display: "grid", gap: 12 }}>
      <div style={{ height: 38, width: 160, background: "var(--color-muted)", borderRadius: 12 }} />
      <div style={{ height: 340, background: "var(--color-muted)", borderRadius: 20 }} />
    </div>
  );

  // Team collaboration coming soon: no promotional tab until it is server-enabled.
  return <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
    {(premiumEnabled || isTeamIQ) && <div className="iq-insight-tabs" role="group" aria-label="Intelligence workspaces">
      <button type="button" aria-pressed={panel === "player"} aria-selected={panel === "player"} onClick={() => setPanel("player")}>My IQ</button>
      {premiumEnabled && <button type="button" aria-pressed={panel === "lab"} aria-selected={panel === "lab"} onClick={() => setPanel("lab")}>Performance Lab</button>}
      {isTeamIQ && <button type="button" aria-pressed={panel === "team"} aria-selected={panel === "team"} onClick={() => setPanel("team")}>Team IQ</button>}
    </div>}

    {panel === "player" && <>
      <PlayerInsights />
      {process.env.NEXT_PUBLIC_COURTIQ_AI_COACH_ENABLED === "true" && playerId && player?.age >= 18 &&
        <details className="iq-depth">
          <summary>Ask CourtIQ AI Coach <span aria-hidden="true">↗</span></summary>
          <div className="iq-depth-body"><AICoach key={playerId} playerId={playerId} /></div>
        </details>}
      <details className="iq-depth">
        <summary>Compare managed players <span aria-hidden="true">↗</span></summary>
        <div className="iq-depth-body"><CoachDashboard /></div>
      </details>
    </>}
    {panel === "lab" && premiumEnabled && <PremiumAnalytics />}
    {panel === "team" && isTeamIQ && <TeamIQScreen />}
  </section>;
}
