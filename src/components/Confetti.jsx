"use client";

import { useEffect, useState } from "react";

const COLORS = ["#FF6B35", "#22C55E", "#3B82F6", "#F59E0B", "#8B5CF6", "#EF4444"];

function Particle({ delay }) {
  const [style] = useState(() => ({
    left: `${Math.random() * 100}%`,
    animationDelay: `${delay}ms`,
    animationDuration: `${1500 + Math.random() * 1000}ms`,
    background: COLORS[Math.floor(Math.random() * COLORS.length)],
    width: `${6 + Math.random() * 6}px`,
    height: `${6 + Math.random() * 6}px`,
    borderRadius: Math.random() > 0.5 ? "50%" : "2px",
    transform: `rotate(${Math.random() * 360}deg)`,
  }));

  return <div className="confetti-particle" style={style} />;
}

export default function Confetti({ duration = 3000, onDone }) {
  const [visible, setVisible] = useState(true);
  const particles = Array.from({ length: 60 }, (_, i) => i);

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      if (onDone) onDone();
    }, duration);
    return () => clearTimeout(t);
  }, [duration, onDone]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[500] pointer-events-none overflow-hidden">
      {particles.map((i) => (
        <Particle key={i} delay={i * 30} />
      ))}
      <style jsx>{`
        .confetti-particle {
          position: absolute;
          top: -10px;
          animation: confettiFall linear forwards;
        }
        @keyframes confettiFall {
          0% {
            opacity: 1;
            transform: translateY(0) rotate(0deg) scale(1);
          }
          50% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translateY(100vh) rotate(720deg) scale(0.5);
          }
        }
      `}</style>
    </div>
  );
}
