"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import Icon from "@/components/ui/Icons";
import { signOutUser } from "@/lib/firebase";

function Row({ icon, title, description, action, actionLabel }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "15px 0", borderBottom: "1px solid var(--color-border)" }}>
      <div style={{ width: 38, height: 38, borderRadius: 11, display: "grid", placeItems: "center", background: "var(--color-muted)", flexShrink: 0 }}>
        <Icon name={icon} size={17} color="var(--color-text-sec)" />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 850, color: "var(--color-text)" }}>{title}</div>
        <div style={{ fontSize: 10, color: "var(--color-text-sec)", lineHeight: 1.45, marginTop: 2 }}>{description}</div>
      </div>
      {action && <button type="button" onClick={action} style={{ minHeight: 40, border: 0, borderRadius: 10, padding: "0 11px", background: "var(--color-muted)", color: "var(--color-text)", fontSize: 11, fontWeight: 850, cursor: "pointer" }}>{actionLabel || "Open"}</button>}
    </div>
  );
}

export default function SettingsScreen({ onEditProfile, onManagePlayers, darkMode, onToggleTheme }) {
  const { user, playerProfile } = useAuth();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <section style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 20, padding: "18px 18px 4px", boxShadow: "var(--shadow-card)" }}>
        <div style={{ fontSize: 10, fontWeight: 900, color: "#FF6B35", textTransform: "uppercase", letterSpacing: 1 }}>Account</div>
        <div style={{ marginTop: 7, fontSize: 19, fontWeight: 950, color: "var(--color-text)" }}>{playerProfile?.name || "CourtIQ player"}</div>
        <div style={{ marginTop: 3, fontSize: 11, color: "var(--color-text-sec)" }}>{user?.email || "Signed-in account"}</div>
        <Row icon="user" title="Player profile" description="Name, team, jersey, position and age." action={onEditProfile} actionLabel="Edit" />
        <Row icon="user" title="Players & family" description="Add, remove or switch managed player profiles." action={onManagePlayers} actionLabel="Manage" />
      </section>

      <section style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 20, padding: "18px 18px 4px", boxShadow: "var(--shadow-card)" }}>
        <div style={{ fontSize: 10, fontWeight: 900, color: "#8B5CF6", textTransform: "uppercase", letterSpacing: 1 }}>Experience</div>
        <Row icon={darkMode ? "moon" : "sun"} title="Appearance" description={darkMode ? "Dark mode is on." : "Light mode is on."} action={onToggleTheme} actionLabel={darkMode ? "Use light" : "Use dark"} />
        <Row icon="shield" title="Youth privacy" description="CourtIQ currently uses an age-13+ account posture. Under-13 guardian consent is not yet offered." />
      </section>

      <section style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 20, padding: 18, boxShadow: "var(--shadow-card)" }}>
        <div style={{ fontSize: 10, fontWeight: 900, color: "#3B82F6", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Privacy & legal</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <Link href="/privacy" style={{ color: "#3B82F6", fontSize: 12, fontWeight: 850 }}>Privacy Policy</Link>
          <Link href="/terms" style={{ color: "#3B82F6", fontSize: 12, fontWeight: 850 }}>Terms of Service</Link>
        </div>
        <p style={{ margin: "12px 0 0", color: "var(--color-text-sec)", fontSize: 10, lineHeight: 1.55 }}>
          CourtIQ distinguishes recorded stats from calculated metrics and coaching recommendations. Ratings are development heuristics, not validated scouting grades.
        </p>
      </section>

      <button type="button" onClick={() => signOutUser()} style={{ minHeight: 48, border: "1px solid rgba(239,68,68,0.25)", borderRadius: 14, background: "rgba(239,68,68,0.07)", color: "#EF4444", fontWeight: 900, cursor: "pointer" }}>
        Sign out
      </button>
    </div>
  );
}
