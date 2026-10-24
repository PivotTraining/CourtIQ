"use client";

import BrandLogo from "@/components/ui/BrandLogo";
import GoogleIdentityButton from "./GoogleIdentityButton";
import { useEffect, useRef, useState } from "react";
import { signInWithEmail, signInWithGoogle, resetPassword } from "@/lib/firebase";

const liveActions = { signInWithEmail, signInWithGoogle, resetPassword };
const inputStyle = {
  width: "100%", padding: "14px 16px", borderRadius: 14,
  border: "1px solid var(--color-border)", background: "var(--color-input-bg, var(--color-muted))",
  fontSize: 15, fontWeight: 500, boxSizing: "border-box", color: "var(--color-text)", fontFamily: "inherit",
};

export default function LoginScreen({ actions = liveActions } = {}) {
  const googleClientId = typeof process === "undefined" ? "" : process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();
  const [showExistingEmail, setShowExistingEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState("");
  const inFlight = useRef(false);
  const alive = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  function beginRequest() {
    if (inFlight.current) return false;
    inFlight.current = true;
    setError("");
    setResetSent("");
    setLoading(true);
    return true;
  }
  function endRequest() {
    inFlight.current = false;
    if (alive.current) setLoading(false);
  }
  const handleGoogle = async () => {
    if (!beginRequest()) return;
    try {
      await actions.signInWithGoogle();
      // The production implementation navigates to Google's OAuth flow.
    } catch (err) {
      if (alive.current) setError(err?.message || "Google sign in couldn't start. Please try again.");
    } finally {
      endRequest();
    }
  };
  const handleSubmit = async event => {
    event.preventDefault();
    if (!showExistingEmail || !beginRequest()) return;
    try {
      const data = await actions.signInWithEmail(email.trim(), password);
      if (!data?.session?.user) throw new Error("Sign in completed without a usable session. Please try again.");
      if (typeof window !== "undefined") window.location.replace("/dashboard");
    } catch (err) {
      if (!alive.current) return;
      const message = err?.message || "Email sign in failed.";
      if (/email (?:not confirmed|not verified)/i.test(message)) {
        setError("This email hasn't been confirmed. Email confirmation delivery is temporarily unavailable. Please contact CourtIQ support.");
      } else if (/invalid login credentials/i.test(message)) {
        setError("Email or password is not recognized. This option is for existing email/password accounts only. New users should use Google.");
      } else {
        setError(message);
      }
    } finally {
      endRequest();
    }
  };
  const handleForgotPassword = async () => {
    if (inFlight.current) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter your existing account email first, then tap Reset password.");
      return;
    }
    if (!beginRequest()) return;
    try {
      await actions.resetPassword(email.trim());
      if (alive.current) setResetSent(email.trim());
    } catch (err) {
      if (alive.current) setError(err?.message || "Could not request a password reset.");
    } finally {
      endRequest();
    }
  };

  return <div style={{ minHeight: "100vh", minHeight: "100dvh", width: "100%", display: "flex", flexDirection: "column", background: "var(--color-bg)" }}>
    <header style={{ minHeight: 222, padding: "max(48px, env(safe-area-inset-top, 48px)) 20px 32px", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", background: "linear-gradient(135deg,#1A1D2E 0%,#2D1B0E 100%)" }}>
      <BrandLogo surface="dark" width={295} />
      <p style={{ marginTop: 12, color: "rgba(255,255,255,.78)", fontSize: 14, textAlign: "center" }}>Track your game. Sharpen your mind.</p>
    </header>
    <main style={{ padding: "25px 20px 36px", flex: 1, width: "100%", maxWidth: 490, margin: "0 auto", boxSizing: "border-box" }}>
      <section style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 22, padding: "25px 20px", boxShadow: "var(--shadow-card)" }}>
        <p style={{ color: "var(--color-accent)", fontSize: 11, fontWeight: 900, letterSpacing: 1.3, margin: "0 0 8px" }}>COURTIQ · FREE BASKETBALL TRACKING</p>
        <h1 style={{ fontSize: 25, fontWeight: 900, margin: "0 0 10px", color: "var(--color-text)", lineHeight: 1.2 }}>Welcome to CourtIQ</h1>
        <p style={{ margin: "0 0 22px", fontSize: 14, lineHeight: 1.6, color: "var(--color-text-sec)" }}>Parents can track multiple players with one account. Get started free with your Google account.</p>

        {googleClientId ? <>
          <GoogleIdentityButton clientId={googleClientId} onError={setError}
            onSuccess={() => window.location.replace("/dashboard")} />
          <button type="button" onClick={handleGoogle} disabled={loading}
            style={{ display: "block", margin: "10px auto 0", background: "none", color: "var(--color-text-sec)", fontSize: 12, border: "none", cursor: "pointer", textDecoration: "underline", padding: 10 }}>
            Trouble with the Google button? Use the alternative login
          </button>
        </> : <>
        <button type="button" onClick={handleGoogle} disabled={loading} aria-label="Continue with Google" style={{
          width: "100%", minHeight: 56, background: "var(--color-text)", border: "1px solid var(--color-border)",
          color: "var(--color-bg)", borderRadius: 15, display: "flex", gap: 12,
          alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 850,
          cursor: loading ? "wait" : "pointer", opacity: loading ? 0.65 : 1,
        }}>
          <svg width="23" height="23" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          {loading ? "Connecting securely…" : "Continue with Google"}
        </button>
        </>}
        <p style={{ color: "var(--color-text-sec)", fontSize: 12, lineHeight: 1.6, textAlign: "center", margin: "15px 0 4px" }}>
          Google handles your sign-in. CourtIQ never sees your Google password.
          You may briefly see Google&apos;s secure sign-in screen before returning to CourtIQ.
        </p>
        <p style={{ color: "var(--color-text-sec)", fontSize: 11, lineHeight: 1.5, textAlign: "center", margin: "9px 0 23px" }}>No credit card required.</p>

        <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: 18 }}>
          <button type="button" onClick={() => { if (!loading) { setShowExistingEmail(value => !value); setError(""); } }}
            disabled={loading} aria-expanded={showExistingEmail} aria-controls="existing-email-signin"
            style={{ width: "100%", minHeight: 44, background: "none", border: 0, cursor: "pointer", color: "var(--color-text)", fontSize: 13, fontWeight: 750, textAlign: "center" }}>
            {showExistingEmail ? "Hide email/password sign in" : "Already have an email/password account? Sign in"}
          </button>
          {showExistingEmail && <div id="existing-email-signin" style={{ marginTop: 12 }}>
            <p style={{ color: "var(--color-text-sec)", fontSize: 12, lineHeight: 1.5, margin: "0 0 14px" }}>
              Existing accounts only. Email registration is temporarily unavailable while we fix confirmation delivery.
            </p>
            <form onSubmit={handleSubmit} aria-busy={loading} style={{ display: "grid", gap: 13 }}>
              <label htmlFor="login-email" style={{ color: "var(--color-text)", fontWeight: 700, fontSize: 13 }}>Account email</label>
              <input id="login-email" type="email" autoComplete="email" required value={email}
                disabled={loading} onChange={event => { setEmail(event.target.value); setResetSent(""); }}
                placeholder="you@example.com" style={inputStyle} />
              <label htmlFor="login-password" style={{ color: "var(--color-text)", fontWeight: 700, fontSize: 13 }}>Password</label>
              <input id="login-password" type="password" autoComplete="current-password" required
                value={password} disabled={loading} onChange={event => setPassword(event.target.value)} style={inputStyle} />
              <button type="submit" disabled={loading} style={{ minHeight: 48, border: 0, borderRadius: 12, background: "var(--color-accent)", color: "white", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
                {loading ? "Signing in…" : "Sign in to existing account"}
              </button>
              <button type="button" disabled={loading} onClick={handleForgotPassword} style={{ minHeight: 44, background: "none", border: "none", color: "var(--color-accent)", fontSize: 12, fontWeight: 750 }}>Reset password</button>
            </form>
            <p style={{ color: "var(--color-text-sec)", fontSize: 11, lineHeight: 1.55 }}>Password reset email delivery may also be delayed. Existing account data will not be removed.</p>
            {resetSent && <p role="status" style={{ fontSize: 12, lineHeight: 1.5, color: "var(--color-text)" }}>If an account exists for {resetSent}, a reset email was requested. Delivery is not guaranteed while email service is being repaired.</p>}
          </div>}
        </div>
        {error && <p role="alert" style={{ color: "#B91C1C", background: "#FEF2F2", padding: "12px 14px", fontSize: 13, lineHeight: 1.5, borderRadius: 12 }}>{error}</p>}
      </section>
      <p style={{ textAlign: "center", maxWidth: 430, margin: "20px auto 10px", color: "var(--color-text-sec)", fontSize: 12, lineHeight: 1.6 }}>
        New email/password registration is temporarily paused while confirmation delivery is repaired. CourtIQ remains free.
      </p>
      <footer style={{ textAlign: "center", margin: "18px auto 0", fontSize: 11, color: "var(--color-text-sec)" }}>
        <a href="/terms" style={{ color: "inherit", textDecoration: "underline" }}>Terms</a>
        {" · "}
        <a href="/privacy" style={{ color: "inherit", textDecoration: "underline" }}>Privacy</a>
        <p style={{ fontSize: 10, margin: "12px auto", opacity: .8 }}>Made in Atlanta, Georgia</p>
      </footer>
    </main>
  </div>;
}
