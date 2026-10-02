"use client";

import CoachDashboard from "@/components/iq/CoachDashboard";
import Icon from "@/components/ui/Icons";

export default function CoachWorkspace() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <section style={{ background: "linear-gradient(135deg,#0F3D2E,#145A42)", color: "white", borderRadius: 22, padding: 20 }}>
        <div style={{ fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1.2, color: "#A7F3D0" }}>Coach workspace</div>
        <h2 style={{ margin: "7px 0 0", fontSize: 24, fontWeight: 950 }}>Compare development across your managed roster.</h2>
        <p style={{ margin: "8px 0 0", color: "rgba(255,255,255,.72)", fontSize: 12, lineHeight: 1.6 }}>
          This workspace uses player profiles already managed by your CourtIQ account. Team invitations and assistant-coach permissions stay off until the production database role model is verified.
        </p>
      </section>

      <CoachDashboard />

      <section style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 18, padding: 18 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <Icon name="shield" size={19} color="#3B82F6" />
          <div>
            <div style={{ fontSize: 12, fontWeight: 900, color: "var(--color-text)" }}>Permission-safe by default</div>
            <p style={{ margin: "4px 0 0", fontSize: 10, color: "var(--color-text-sec)", lineHeight: 1.55 }}>
              CourtIQ does not expose another family's players through this screen. Cross-account coach invitations will only be enabled after backend-enforced roles and invitation verification are live.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
