"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useApp } from "@/context/AppContext";
import { fetchManagedPlayers, fetchSessionHistory } from "@/lib/queries";

const buttonStyle = {
  minHeight: 44, border: "1px solid var(--color-border)", borderRadius: 11,
  background: "var(--color-muted)", padding: "10px 14px",
  color: "var(--color-text)", fontSize: 12, fontWeight: 800, cursor: "pointer",
};

// Runs every query under the signed-in user's Supabase session and existing RLS.
// Never creates, deletes, transfers or reassigns athlete profiles or game entries.
export default function SavedStatsRecovery() {
  const { user, playerProfile, switchToManagedPlayer } = useAuth();
  const { setScreen } = useApp();
  const [found, setFound] = useState(null);
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState("");
  const [error, setError] = useState("");
  const revision = useRef(0);

  useEffect(() => {
    revision.current += 1;
    setFound(null); setError(""); setBusy(false); setOpening("");
    return () => { revision.current += 1; };
  }, [user?.id]);

  const inspect = async () => {
    if (!user?.id || busy) return;
    const id = user.id, request = ++revision.current;
    setBusy(true); setError(""); setFound(null);
    try {
      const profiles = await fetchManagedPlayers(id);
      if (profiles.length > 30) throw new Error("Too many player profiles to inspect safely.");
      const summary = await Promise.all(profiles.map(async profile => {
        const sessions = await fetchSessionHistory(profile.id);
        return {
          id: profile.id, name: profile.name,
          games: sessions.filter(session => session.type === "game").length,
          practices: sessions.filter(session => session.type === "practice").length,
          shots: sessions.reduce((sum, session) => sum + (session.shot_logs?.length || 0), 0),
        };
      }));
      if (revision.current === request) setFound(summary);
    } catch {
      if (revision.current === request) setError("CourtIQ couldn't verify saved games right now. Nothing was deleted. Check your connection and try again.");
    } finally {
      if (revision.current === request) setBusy(false);
    }
  };

  const openHistory = async profile => {
    if (!user?.id || opening || busy) return;
    const request = ++revision.current;
    setOpening(profile.id); setError("");
    try {
      if (playerProfile?.id !== profile.id) await switchToManagedPlayer(profile.id);
      if (request === revision.current) setScreen("gamelog");
    } catch {
      if (request === revision.current) setError("Could not switch to that player. Your saved stats remain unchanged; please try again.");
    } finally {
      if (request === revision.current) setOpening("");
    }
  };

  return (
    <section aria-label="Find saved statistics" style={{ padding: "12px 0 17px", borderBottom: "1px solid var(--color-border)" }}>
      <div style={{ fontSize: 13, fontWeight: 850, color: "var(--color-text)" }}>Can&apos;t find your game stats?</div>
      <p style={{ fontSize: 12, lineHeight: 1.55, margin: "6px 0 10px", color: "var(--color-text-sec)" }}>
        Your records belong to the account used to save them. Signed in as <strong>{user?.email || "an unverified account"}</strong>.
        Check saved players and open their game histories without changing any data.
      </p>
      <button type="button" style={buttonStyle} disabled={busy || !!opening || !user?.id}
        onClick={inspect}>{busy ? "Checking saved games…" : "Find my saved games"}</button>
      {error && <p role="alert" style={{ fontSize: 12, color: "var(--color-danger)", marginTop: 10 }}>{error}</p>}
      {found && <div aria-live="polite" role="status" style={{ marginTop: 12, display: "grid", gap: 10 }}>
        {found.length === 0 ? <p style={{ fontSize: 12, lineHeight: 1.55 }}>
          No players were found under this signed-in account. If you used another email, sign in to that original account.
          Do not create a new profile to recover an existing player&apos;s games.
        </p> : found.map(profile => (
          <div key={profile.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
            padding: "10px 12px", borderRadius: 12, border: "1px solid var(--color-border)" }}>
            <div>
              <strong style={{ display: "block", fontSize: 13 }}>{profile.name}</strong>
              <span style={{ display: "block", fontSize: 11, marginTop: 3, color: "var(--color-text-sec)" }}>
                {profile.games} games · {profile.practices} practices · {profile.shots} shot entries
              </span>
            </div>
            <button type="button" style={buttonStyle} disabled={busy || !!opening}
              onClick={() => openHistory(profile)}>{opening === profile.id ? "Opening…" : "Open games"}</button>
          </div>
        ))}
      </div>}
      <p style={{ fontSize: 10, lineHeight: 1.5, marginTop: 9, color: "var(--color-text-sec)" }}>
        This checks server-saved history only. Local recordings and unsynced game entries may remain on the original device.
        Don&apos;t clear website data or reinstall to troubleshoot.
      </p>
    </section>
  );
}
