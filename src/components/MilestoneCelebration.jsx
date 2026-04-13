"use client";

import { useState, useEffect } from "react";
import Icon from "@/components/ui/Icons";

export default function MilestoneCelebration({ badge, onDismiss }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Delay entrance for dramatic effect
    const t1 = setTimeout(() => setVisible(true), 100);
    // Auto-dismiss after 4 seconds
    const t2 = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300);
    }, 4000);
    // Haptic
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([50, 100, 50]);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDismiss]);

  if (!badge) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 400,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.6)",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.3s ease",
        pointerEvents: visible ? "auto" : "none",
      }}
      onClick={() => { setVisible(false); setTimeout(onDismiss, 300); }}
    >
      <div
        style={{
          transform: visible ? "scale(1)" : "scale(0.5)",
          opacity: visible ? 1 : 0,
          transition: "all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
          textAlign: "center",
        }}
      >
        {/* Glow ring */}
        <div style={{ position: "relative", display: "inline-block", marginBottom: 16 }}>
          <div style={{
            width: 112,
            height: 112,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #FF6B35, #E85A2A)",
            boxShadow: "0 0 60px rgba(255,107,53,0.5), 0 0 120px rgba(255,107,53,0.2)",
          }}>
            {badge.iconName ? <Icon name={badge.iconName} size={56} color="white" /> : <Icon name="star" size={56} color="white" />}
          </div>
        </div>

        <div style={{
          fontSize: 11,
          color: "rgba(255,255,255,0.6)",
          textTransform: "uppercase",
          letterSpacing: 3,
          marginBottom: 8,
        }}>
          Badge Unlocked
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, color: "white", marginBottom: 8 }}>{badge.name}</div>
        <div style={{ fontSize: 15, color: "rgba(255,255,255,0.7)" }}>{badge.desc}</div>
      </div>
    </div>
  );
}
