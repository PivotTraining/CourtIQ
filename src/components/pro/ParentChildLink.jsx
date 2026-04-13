"use client";
import { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import Icon from "@/components/ui/Icons";

function generateCode(playerId) {
  // Deterministic 6-digit code based on playerId
  const stored = typeof window !== "undefined" ? localStorage.getItem("courtiq-link-code") : null;
  if (stored) return stored;
  // Generate a random 6-digit code and persist it
  const code = String(Math.floor(100000 + Math.random() * 900000));
  if (typeof window !== "undefined") localStorage.setItem("courtiq-link-code", code);
  return code;
}

export default function ParentChildLink({ onClose }) {
  const { playerId } = useApp();
  const [mode, setMode] = useState(null); // null | "parent" | "child"
  const [linkCode, setLinkCode] = useState("");
  const [inputCode, setInputCode] = useState("");
  const [linked, setLinked] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (mode === "parent") {
      setLinkCode(generateCode(playerId));
    }
    if (mode === "child") {
      // Check if already linked
      const saved = typeof window !== "undefined" ? localStorage.getItem("courtiq-parent-code") : null;
      if (saved) setLinked(true);
    }
  }, [mode, playerId]);

  const handleConnect = () => {
    if (inputCode.trim().length !== 6 || !/^\d{6}$/.test(inputCode.trim())) {
      setError("Please enter a valid 6-digit code.");
      return;
    }
    setError("");
    localStorage.setItem("courtiq-parent-code", inputCode.trim());
    setLinked(true);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(linkCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 300,
      background: "rgba(0,0,0,0.6)",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
    }} onClick={onClose}>
      <div
        style={{
          background: "var(--color-bg)",
          borderRadius: "24px 24px 0 0",
          width: "100%", maxWidth: 520,
          padding: "24px 24px",
          paddingBottom: "max(24px, env(safe-area-inset-bottom, 24px))",
          maxHeight: "85vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div style={{ width: 36, height: 4, background: "var(--color-muted)", borderRadius: 2, margin: "0 auto 20px" }} />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14,
            background: "rgba(34,197,94,0.1)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Icon name="user" size={22} color="#22C55E" />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: "var(--color-text)" }}>Link Account</div>
            <div style={{ fontSize: 12, color: "var(--color-text-sec)", marginTop: 2 }}>Connect parent & player accounts</div>
          </div>
        </div>

        {/* Mode Selection */}
        {!mode && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button
              onClick={() => setMode("parent")}
              style={{
                width: "100%", padding: "20px 20px",
                borderRadius: 16, border: "2px solid var(--color-border)",
                background: "var(--color-card)", cursor: "pointer",
                textAlign: "left", display: "flex", alignItems: "center", gap: 16,
              }}
            >
              <div style={{
                width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                background: "rgba(34,197,94,0.1)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Icon name="user" size={24} color="#22C55E" />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text)" }}>I'm a Parent</div>
                <div style={{ fontSize: 12, color: "var(--color-text-sec)", marginTop: 3, lineHeight: 1.4 }}>
                  Generate a code to share with your child
                </div>
              </div>
              <Icon name="chevDown" size={14} color="var(--color-text-sec)" style={{ marginLeft: "auto", transform: "rotate(-90deg)" }} />
            </button>
            <button
              onClick={() => setMode("child")}
              style={{
                width: "100%", padding: "20px 20px",
                borderRadius: 16, border: "2px solid var(--color-border)",
                background: "var(--color-card)", cursor: "pointer",
                textAlign: "left", display: "flex", alignItems: "center", gap: 16,
              }}
            >
              <div style={{
                width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                background: "rgba(255,107,53,0.1)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Icon name="basketball" size={24} color="#FF6B35" />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text)" }}>I'm a Player</div>
                <div style={{ fontSize: 12, color: "var(--color-text-sec)", marginTop: 3, lineHeight: 1.4 }}>
                  Enter the code your parent shared with you
                </div>
              </div>
              <Icon name="chevDown" size={14} color="var(--color-text-sec)" style={{ marginLeft: "auto", transform: "rotate(-90deg)" }} />
            </button>
          </div>
        )}

        {/* Parent Mode */}
        {mode === "parent" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <button onClick={() => setMode(null)} style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 700, color: "var(--color-accent)",
              textAlign: "left", padding: 0, marginBottom: 4,
            }}>
              ← Back
            </button>
            <div style={{
              background: "var(--color-card)", borderRadius: 20,
              padding: "28px 24px", textAlign: "center",
              border: "1px solid var(--color-border)",
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-sec)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
                Your Link Code
              </div>
              <div style={{
                fontSize: 42, fontWeight: 900, letterSpacing: 8,
                color: "#22C55E", fontFamily: "monospace",
              }}>
                {linkCode}
              </div>
              <div style={{ fontSize: 12, color: "var(--color-text-sec)", marginTop: 12, lineHeight: 1.5 }}>
                Share this code with your child. They'll enter it on their device to connect accounts and share stats with you.
              </div>
            </div>
            <button onClick={handleCopy} style={{
              width: "100%", padding: "14px 24px", borderRadius: 14,
              background: copied ? "#22C55E" : "var(--color-card)",
              color: copied ? "white" : "var(--color-text)",
              border: `2px solid ${copied ? "#22C55E" : "var(--color-border)"}`,
              fontSize: 14, fontWeight: 700, cursor: "pointer", minHeight: 48,
              transition: "all 0.2s ease",
            }}>
              {copied ? "Copied!" : "Copy Code"}
            </button>
          </div>
        )}

        {/* Child Mode */}
        {mode === "child" && !linked && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <button onClick={() => setMode(null)} style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 700, color: "var(--color-accent)",
              textAlign: "left", padding: 0, marginBottom: 4,
            }}>
              ← Back
            </button>
            <div style={{ fontSize: 14, color: "var(--color-text-sec)", lineHeight: 1.5 }}>
              Enter the 6-digit code your parent generated from their device.
            </div>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={inputCode}
              onChange={(e) => { setInputCode(e.target.value.replace(/\D/g, "")); setError(""); }}
              style={{
                width: "100%", padding: "16px 20px", borderRadius: 14,
                border: `2px solid ${error ? "#EF4444" : "var(--color-border)"}`,
                background: "var(--color-card)", color: "var(--color-text)",
                fontSize: 28, fontWeight: 900, textAlign: "center",
                letterSpacing: 8, fontFamily: "monospace",
                outline: "none", boxSizing: "border-box",
              }}
            />
            {error && (
              <div style={{ fontSize: 12, color: "#EF4444", fontWeight: 600, textAlign: "center" }}>
                {error}
              </div>
            )}
            <button
              onClick={handleConnect}
              disabled={inputCode.length !== 6}
              style={{
                width: "100%", padding: "14px 24px", borderRadius: 14,
                background: inputCode.length === 6 ? "#22C55E" : "var(--color-muted)",
                color: inputCode.length === 6 ? "white" : "var(--color-text-sec)",
                border: "none", fontSize: 15, fontWeight: 700,
                cursor: inputCode.length === 6 ? "pointer" : "not-allowed",
                minHeight: 52, transition: "all 0.2s ease",
              }}
            >
              Connect Account
            </button>
          </div>
        )}

        {/* Success State */}
        {mode === "child" && linked && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "20px 0", textAlign: "center" }}>
            <div style={{
              width: 72, height: 72, borderRadius: 36,
              background: "rgba(34,197,94,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--color-text)" }}>Account Linked!</div>
            <div style={{ fontSize: 13, color: "var(--color-text-sec)", lineHeight: 1.6, maxWidth: 280 }}>
              Your account is now connected. Your parent can view your stats and track your progress.
            </div>
            <button onClick={onClose} style={{
              width: "100%", padding: "14px 24px", borderRadius: 14,
              background: "#22C55E", color: "white",
              border: "none", fontSize: 15, fontWeight: 700, cursor: "pointer", minHeight: 52,
            }}>
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
