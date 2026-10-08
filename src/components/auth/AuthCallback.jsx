"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { safeNextPath, passwordError } from "@/lib/webAuth.mjs";

export default function AuthCallback() {
  const [message, setMessage] = useState("Finishing sign in…");
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const exchange = useRef(null);
  const alive = useRef(false);
  const passwordPending = useRef(false);

  useEffect(() => {
    let active = true;
    alive.current = true;
    // Keep the single-use exchange in flight, but offer a way out if it stalls.
    const slowTimer = setTimeout(() => {
      if (active) setMessage("Sign in is taking longer than expected. Check your connection. You can return to CourtIQ and start again.");
    }, 15000);

    async function finishSignIn() {
      const params = new URLSearchParams(window.location.search);
      const oauthError = params.get("error_description") || params.get("error");
      if (oauthError) {
        clearTimeout(slowTimer);
        if (active) setMessage(`Sign in was not completed: ${oauthError}`);
        return;
      }

      const code = params.get("code");
      if (!code) {
        clearTimeout(slowTimer);
        if (active) setMessage("This sign-in link is incomplete. Return to CourtIQ and try again.");
        return;
      }

      // Reuse the exchange when React remounts effects in development: codes are single-use.
      exchange.current ||= supabase.auth.exchangeCodeForSession(code);
      const { data, error } = await exchange.current;
      clearTimeout(slowTimer);
      if (!active) return;
      if (error) {
        console.error("[auth/callback] exchange failed:", error.message);
        if (active) setMessage(`We could not complete sign in: ${error.message}`);
        return;
      }

      if (!data?.session) {
        if (active) setMessage("Sign in completed without a session. Return to CourtIQ and try again.");
        return;
      }

      if (params.get("mode") === "reset") {
        setRecoveryReady(true);
        setMessage("Choose a new password for CourtIQ.");
        return;
      }

      const next = safeNextPath(params.get("next"));
      window.location.replace(next);
    }

    finishSignIn().catch(() => {
      clearTimeout(slowTimer);
      if (active) setMessage("We couldn't reach the sign-in service. Return to CourtIQ and try again.");
    });
    return () => { active = false; alive.current = false; clearTimeout(slowTimer); };
  }, []);

  async function savePassword(event) {
    event.preventDefault();
    if (passwordPending.current) return;
    const validation = passwordError(password, confirmation);
    if (validation) { setMessage(validation); return; }
    passwordPending.current = true;
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      if (alive.current) window.location.replace("/dashboard");
    } catch (error) {
      if (alive.current) setMessage(error.message || "We couldn't update your password. Please try again.");
    } finally {
      passwordPending.current = false;
      if (alive.current) setSaving(false);
    }
  }

  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ textAlign: "center", maxWidth: 480 }}>
        <h1 style={{ fontSize: 26, marginBottom: 16 }}>{recoveryReady ? "Reset your password" : "CourtIQ sign in"}</h1>
        <p role="status">{message}</p>
        {recoveryReady && (
          <form onSubmit={savePassword} aria-busy={saving} style={{ display: "grid", gap: 14, marginTop: 24, textAlign: "left" }}>
            <label htmlFor="new-password">New password</label>
            <input id="new-password" disabled={saving} type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} style={{ padding: 14, border: "1px solid var(--color-border)", borderRadius: 12 }} />
            <label htmlFor="confirm-password">Confirm password</label>
            <input id="confirm-password" disabled={saving} type="password" autoComplete="new-password" required minLength={8} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} style={{ padding: 14, border: "1px solid var(--color-border)", borderRadius: 12 }} />
            <button className="btn-primary" disabled={saving} type="submit">{saving ? "Saving…" : "Save new password"}</button>
          </form>
        )}
        {message !== "Finishing sign in…" && !recoveryReady && (
          <a href="/dashboard" style={{ color: "#FF6B35", fontWeight: 700 }}>Return to CourtIQ</a>
        )}
      </div>
    </main>
  );
}
