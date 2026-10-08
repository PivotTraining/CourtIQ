"use client";

import { useEffect, useRef, useState } from "react";
import { signInWithEmail, signUpWithEmail, signInWithGoogle, resetPassword } from "@/lib/firebase";

const inputStyle = {
  width: "100%", padding: "14px 16px", borderRadius: 14,
  border: "1px solid var(--color-border)", background: "var(--color-input-bg, var(--color-muted))",
  fontSize: 15, fontWeight: 500, outline: "none", boxSizing: "border-box",
  color: "var(--color-text)", fontFamily: "inherit",
};

const labelStyle = {
  fontSize: 11, fontWeight: 700, color: "var(--color-text-sec)",
  textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6,
};

const liveActions = { signInWithEmail, signUpWithEmail, signInWithGoogle, resetPassword };

export default function LoginScreen({ actions = liveActions } = {}) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState("");
  const [confirmationSent, setConfirmationSent] = useState(false);
  const inFlight = useRef(false);
  const alive = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  function beginRequest() {
    if (inFlight.current) return false;
    inFlight.current = true;
    setError(""); setResetSent(""); setConfirmationSent(false); setLoading(true);
    return true;
  }
  function endRequest() {
    inFlight.current = false;
    if (alive.current) setLoading(false);
  }

  const handleForgotPassword = async () => {
    if (inFlight.current) return;
    const requestedEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requestedEmail)) { setError("Enter a valid email first, then tap Forgot Password."); return; }
    if (!beginRequest()) return;
    try {
      await actions.resetPassword(requestedEmail);
      if (alive.current) setResetSent(requestedEmail);
    } catch (err) {
      if (alive.current) setError(err.message || "Could not send reset email");
    } finally {
      endRequest();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!beginRequest()) return;
    try {
      if (isSignUp) {
        const data = await actions.signUpWithEmail(email.trim(), password);
        if (alive.current && !data?.session) setConfirmationSent(true);
      } else {
        await actions.signInWithEmail(email.trim(), password);
      }
    } catch (err) {
      if (alive.current) setError(err.message || "Something went wrong");
    } finally {
      endRequest();
    }
  };

  const handleGoogle = async () => {
    if (!beginRequest()) return;
    try {
      await actions.signInWithGoogle();
    } catch (err) {
      if (alive.current) setError(err.message || "Something went wrong");
    } finally {
      endRequest();
    }
  };

  return (
    <div style={{
      width: "100%", minHeight: "100vh", minHeight: "100dvh",
      display: "flex", flexDirection: "column",
      background: "var(--color-bg)", overflowX: "hidden",
    }}>
      {/* Hero */}
      <div style={{
        width: "100%", flexShrink: 0, position: "relative", overflow: "hidden",
        background: "linear-gradient(135deg, #1A1D2E 0%, #2D1B0E 100%)",
        minHeight: 220,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        paddingTop: "max(48px, env(safe-area-inset-top, 48px))",
        paddingBottom: 32, paddingLeft: 24, paddingRight: 24,
      }}>
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 300, height: 300, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.06)" }} />
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 180, height: 180, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.04)" }} />
        <img src="/courtiq-dark.png" alt="Court IQ" style={{ height: 56, objectFit: "contain", marginBottom: 12, position: "relative", zIndex: 1 }} />
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", margin: 0, position: "relative", zIndex: 1, letterSpacing: 0.5, fontWeight: 500 }}>
          Track your game. Sharpen your mind.
        </p>
        <svg viewBox="0 0 100 10" preserveAspectRatio="none" style={{ position: "absolute", bottom: -1, left: 0, width: "100%", height: 20 }}>
          <path d="M0 10 L0 4 Q50 -2 100 4 L100 10 Z" fill="var(--color-bg)" />
        </svg>
      </div>

      {/* Form Card */}
      <div style={{ flex: 1, width: "100%", padding: "0 24px 24px", display: "flex", flexDirection: "column", marginTop: -1 }}>
        <div style={{
          width: "100%", maxWidth: 420, margin: "0 auto",
          background: "var(--color-card)", borderRadius: 20, padding: 24,
          boxShadow: "0 8px 32px rgba(0,0,0,0.08)", border: "1px solid var(--color-border)",
        }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--color-text)", margin: "0 0 4px" }}>
            {isSignUp ? "Create Account" : "Welcome Back"}
          </h2>
          <p style={{ fontSize: 13, color: "var(--color-text-sec)", margin: "0 0 20px" }}>
            {isSignUp ? "Start tracking your basketball journey" : "Pick up where you left off"}
          </p>

          <form onSubmit={handleSubmit} aria-busy={loading} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label htmlFor="login-email" style={labelStyle}>Email</label>
              <input
                id="login-email"
                disabled={loading} type="email" value={email} onChange={(e) => { setEmail(e.target.value); setResetSent(""); setConfirmationSent(false); setError(""); }}
                placeholder="you@email.com" required autoComplete="email"
                style={inputStyle}
              />
            </div>

            <div>
              <label htmlFor="login-password" style={labelStyle}>Password</label>
              <input
                id="login-password"
                disabled={loading} type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder={isSignUp ? "8+ characters" : "Your password"}
                required minLength={isSignUp ? 8 : 1}
                autoComplete={isSignUp ? "new-password" : "current-password"}
                style={inputStyle}
              />
            </div>

            {!isSignUp && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: -4 }}>
                <button type="button" onClick={handleForgotPassword} disabled={loading} style={{
                  fontSize: 12, color: "#FF6B35", fontWeight: 600,
                  background: "none", border: "none", cursor: "pointer", padding: "4px 0",
                }}>
                  Forgot Password?
                </button>
              </div>
            )}

            {resetSent && (
              <div role="status" style={{
                fontSize: 12, color: "#166534", background: "#F0FDF4",
                padding: "10px 14px", borderRadius: 12, border: "1px solid #BBF7D0", lineHeight: 1.5,
              }}>
                If an account exists for {resetSent}, a reset link has been requested. Check your inbox and spam folder. Open the link in this same browser.
              </div>
            )}

            {error && (
              <div role="alert" style={{
                fontSize: 12, color: "#B91C1C", background: "#FEF2F2",
                padding: "10px 14px", borderRadius: 12, border: "1px solid #FECACA", lineHeight: 1.5,
              }}>
                {error}
              </div>
            )}

            {confirmationSent && (
              <p role="status" style={{ fontSize: 13, lineHeight: 1.5, color: "var(--color-text-sec)" }}>
                Check your inbox to confirm your email. Open the link in this same browser, then return to CourtIQ to sign in.
              </p>
            )}

            <button type="submit" disabled={loading} style={{
              width: "100%", padding: "16px 0", borderRadius: 16,
              background: "#FF6B35", color: "white", fontSize: 16, fontWeight: 700,
              border: "none", cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.7 : 1, minHeight: 52, marginTop: 4,
              boxShadow: "0 4px 16px rgba(255,107,53,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}>
              {loading ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTop: "2px solid white", borderRadius: "50%", animation: "spin 0.8s linear infinite", display: "inline-block" }} />
                  {isSignUp ? "Creating..." : "Signing In..."}
                </span>
              ) : (
                <>{isSignUp ? "Create Account" : "Sign In"} <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-6-6 6 6-6 6" /></svg></>
              )}
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
            <div style={{ flex: 1, height: 1, background: "var(--color-border)" }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--color-text-sec)", textTransform: "uppercase", letterSpacing: 1 }}>or</span>
            <div style={{ flex: 1, height: 1, background: "var(--color-border)" }} />
          </div>

          {/* Google */}
          <button onClick={handleGoogle} disabled={loading} style={{
            width: "100%", padding: "14px 0", borderRadius: 14,
            background: "var(--color-muted)", color: "var(--color-text)",
            fontSize: 14, fontWeight: 600, border: "1px solid var(--color-border)",
            cursor: loading ? "default" : "pointer", minHeight: 48,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>

          {/* Toggle sign-in / sign-up */}
          <p style={{ textAlign: "center", fontSize: 13, color: "var(--color-text-sec)", marginTop: 20, marginBottom: 0 }}>
            {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
            <button disabled={loading} onClick={() => { if (inFlight.current) return; setIsSignUp(!isSignUp); setError(""); setResetSent(""); setConfirmationSent(false); setPassword(""); }} style={{
              color: "#FF6B35", fontWeight: 700, background: "none", border: "none", cursor: "pointer", fontSize: 13,
            }}>
              {isSignUp ? "Sign In" : "Sign Up"}
            </button>
          </p>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: "auto", paddingTop: 16, paddingBottom: 8 }}>
          <p style={{ fontSize: 10, color: "var(--color-text-sec)", opacity: 0.5, margin: 0 }}>
            Made in Atlanta, Georgia
          </p>
          <p style={{ fontSize: 10, color: "var(--color-text-sec)", opacity: 0.4, marginTop: 4 }}>
            <a href="/terms" style={{ textDecoration: "underline", color: "inherit" }}>Terms</a>
            {" · "}
            <a href="/privacy" style={{ textDecoration: "underline", color: "inherit" }}>Privacy</a>
          </p>
        </div>
      </div>
    </div>
  );
}
