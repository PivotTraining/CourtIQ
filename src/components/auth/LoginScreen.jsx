"use client";

import { useState } from "react";
import { signInWithEmail, signUpWithEmail, signInWithGoogle, signInWithApple, resetPassword } from "@/lib/firebase";
import Icon from "@/components/ui/Icons";

function isCapacitor() {
  if (typeof window === "undefined") return false;
  return !!window.Capacitor?.isNativePlatform?.();
}

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

export default function LoginScreen() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const isNative = typeof window !== "undefined" && isCapacitor();

  const handleForgotPassword = async () => {
    if (!email) { setError("Enter your email first, then tap Forgot Password."); return; }
    setError("");
    try {
      await resetPassword(email);
      setResetSent(true);
    } catch (err) {
      setError(err.message || "Could not send reset email");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isSignUp) {
        await signUpWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError("");
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleApple = async () => {
    setError("");
    setLoading(true);
    try {
      await signInWithApple();
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
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

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={labelStyle}>Email</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com" required autoComplete="email"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Password</label>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder={isSignUp ? "6+ characters" : "Your password"}
                required minLength={6}
                autoComplete={isSignUp ? "new-password" : "current-password"}
                style={inputStyle}
              />
            </div>

            {!isSignUp && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: -4 }}>
                <button type="button" onClick={handleForgotPassword} style={{
                  fontSize: 12, color: "#FF6B35", fontWeight: 600,
                  background: "none", border: "none", cursor: "pointer", padding: "4px 0",
                }}>
                  Forgot Password?
                </button>
              </div>
            )}

            {resetSent && (
              <div style={{
                fontSize: 12, color: "#22C55E", background: "#F0FDF4",
                padding: "10px 14px", borderRadius: 12, border: "1px solid #BBF7D0", lineHeight: 1.5,
              }}>
                Password reset email sent to {email}. Check your inbox.
              </div>
            )}

            {error && (
              <div style={{
                fontSize: 12, color: "#DC2626", background: "#FEF2F2",
                padding: "10px 14px", borderRadius: 12, border: "1px solid #FECACA", lineHeight: 1.5,
              }}>
                {error}
              </div>
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
                <>{isSignUp ? "Create Account" : "Sign In"} <Icon name="forward" size={16} color="white" /></>
              )}
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
            <div style={{ flex: 1, height: 1, background: "var(--color-border)" }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--color-text-sec)", textTransform: "uppercase", letterSpacing: 1 }}>or</span>
            <div style={{ flex: 1, height: 1, background: "var(--color-border)" }} />
          </div>

          {/* Apple Sign In — shown on native iOS */}
          {isNative && (
            <button onClick={handleApple} disabled={loading} style={{
              width: "100%", padding: "14px 0", borderRadius: 14, marginBottom: 10,
              background: "#000", color: "#fff",
              fontSize: 14, fontWeight: 600, border: "none",
              cursor: loading ? "default" : "pointer", minHeight: 48,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            }}>
              {/* Apple logo SVG */}
              <svg width="17" height="17" viewBox="0 0 814 1000" fill="white">
                <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 405.8 30.7 295 30.7 211.1c0-185.8 121.5-284.3 241-284.3 63.5 0 116.6 41.9 155.5 41.9 37.3 0 96.5-44.4 168.3-44.4 26.5 0 108.2 2.6 167.4 98.3zm-88-52.3c-30.4-35.8-73.6-62.2-121-62.2-81.4 0-137.2 53.5-162 53.5-27.2 0-90.4-54.2-162.5-54.2-112.5 0-230.3 87.4-230.3 257.1 0 60.5 11.7 123.1 35.1 185.4 31.7 85.2 131.4 262 235.1 262 26.5 0 64.2-17.7 137.8-17.7 71.3 0 107.3 18.3 142 18.3 103 0 206.7-170.3 234.4-255.5-52.5-22.5-131.2-88-131.2-197.3 0-97.7 62.3-153.8 97.7-183.8l-37.4-5.6z"/>
              </svg>
              Continue with Apple
            </button>
          )}

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
            <button onClick={() => { setIsSignUp(!isSignUp); setError(""); }} style={{
              color: "#FF6B35", fontWeight: 700, background: "none", border: "none", cursor: "pointer", fontSize: 13,
            }}>
              {isSignUp ? "Sign In" : "Sign Up"}
            </button>
          </p>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: "auto", paddingTop: 16, paddingBottom: 8 }}>
          <p style={{ fontSize: 10, color: "var(--color-text-sec)", opacity: 0.5, margin: 0 }}>
            A product of Pivot Training and Development
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
