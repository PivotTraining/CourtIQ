"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

// Adding/changing a password must happen in the authenticated user's session.
// It never creates another CourtIQ profile or changes a Google OAuth identity.
export default function PasswordAccess({ emailConfirmed = false, email = "" }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const inFlight = useRef(false), alive = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const submit = async event => {
    event.preventDefault();
    if (inFlight.current) return;
    setError(""); setMessage("");
    if (!email || !emailConfirmed) {
      setError("Your account email must be confirmed before you can add or change a password.");
      return;
    }
    if (password.length < 8) { setError("Use at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    inFlight.current = true;
    setBusy(true);
    try {
      const { data, error: authError } = await supabase.auth.updateUser({ password });
      if (authError) throw authError;
      if (!data?.user) throw new Error("The server did not confirm the password change.");
      if (alive.current) {
        setPassword(""); setConfirm(""); setOpen(false);
        setMessage("Password saved. You can use your account email and this password to sign in. Google sign-in remains available.");
      }
    } catch (cause) {
      if (alive.current) {
        const text = cause?.message || "";
        setError(/reauth|recent|nonce|security check/i.test(text)
          ? "For security, sign out and back in with Google, then try adding your password again."
          : text || "Could not save your password. Try again without signing out.");
      }
    } finally {
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
  };

  return <section aria-label="Password sign-in access" style={{ padding: "15px 0", borderBottom: "1px solid var(--color-border)" }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <div style={{ minWidth: 0 }}>
        <strong style={{ fontSize: 13, color: "var(--color-text)" }}>Email & password sign-in</strong>
        <p style={{ fontSize: 11, lineHeight: 1.5, color: "var(--color-text-sec)", margin: "4px 0 0" }}>
          Add or change your password without creating a second account. Your Google sign-in will still work.
        </p>
      </div>
      <button type="button" disabled={busy} aria-expanded={open} onClick={() => { setOpen(value => !value); setError(""); setMessage(""); setPassword(""); setConfirm(""); }}
        style={{ border: "1px solid var(--color-border)", borderRadius: 10, background: "var(--color-muted)", color: "var(--color-text)", minHeight: 44, padding: "8px 12px", fontWeight: 800, fontSize: 11, flexShrink: 0 }}>
        {open ? "Close" : "Set password"}
      </button>
    </div>
    {message && <p role="status" style={{ fontSize: 12, lineHeight: 1.5, color: "var(--color-text)", marginTop: 10 }}>{message}</p>}
    {open && <form onSubmit={submit} aria-busy={busy} style={{ display: "grid", gap: 12, marginTop: 15 }}>
      <p style={{ fontSize: 11, lineHeight: 1.6, color: "var(--color-text-sec)", margin: 0 }}>
        Password belongs to your confirmed account email. Never share it with CourtIQ support.
      </p>
      <label htmlFor="account-password" style={{ display: "grid", gap: 6, color: "var(--color-text)", fontSize: 12 }}>
        New password
        <input id="account-password" type="password" autoComplete="new-password" minLength={8} required
          value={password} onChange={event => setPassword(event.target.value)} disabled={busy} placeholder="8 or more characters"
          style={{ borderRadius: 10, border: "1px solid var(--color-border)", padding: "12px", color: "var(--color-text)", background: "var(--color-input-bg)", width: "100%", fontSize: 14 }} />
      </label>
      <label htmlFor="account-password-confirm" style={{ display: "grid", gap: 6, color: "var(--color-text)", fontSize: 12 }}>
        Confirm password
        <input id="account-password-confirm" type="password" autoComplete="new-password" minLength={8} required
          value={confirm} onChange={event => setConfirm(event.target.value)} disabled={busy}
          style={{ borderRadius: 10, border: "1px solid var(--color-border)", padding: "12px", color: "var(--color-text)", background: "var(--color-input-bg)", width: "100%", fontSize: 14 }} />
      </label>
      {error && <p role="alert" style={{ fontSize: 12, lineHeight: 1.5, color: "var(--color-danger)", margin: 0 }}>{error}</p>}
      <button type="submit" disabled={busy || !password || !confirm || !emailConfirmed}
        style={{ minHeight: 48, border: 0, borderRadius: 11, background: "#F16438", color: "#FFF", fontSize: 13, fontWeight: 850 }}>
        {busy ? "Saving securely…" : "Save password"}
      </button>
      {!emailConfirmed && <p role="alert" style={{ fontSize: 11, color: "var(--color-text-sec)" }}>Confirm your account email before enabling password sign-in.</p>}
    </form>}
  </section>;
}
