"use client";

import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/Icons";

function haptic() {
  if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(20);
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function WorkoutTimer({ drills, onComplete }) {
  const [currentDrill, setCurrentDrill] = useState(0);
  const [repsCompleted, setRepsCompleted] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const [restTime, setRestTime] = useState(30);
  const [paused, setPaused] = useState(false);
  const [done, setDone] = useState(false);
  const timerRef = useRef(null);

  const drill = drills[currentDrill];
  const totalDrills = drills.length;
  const progress = ((currentDrill + repsCompleted / (drill?.reps || 1)) / totalDrills) * 100;

  // Timer
  useEffect(() => {
    if (paused || done) return;
    timerRef.current = setInterval(() => {
      if (isResting) {
        setRestTime((prev) => {
          if (prev <= 1) {
            setIsResting(false);
            haptic();
            return 30;
          }
          return prev - 1;
        });
      } else {
        setElapsed((prev) => prev + 1);
      }
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [paused, done, isResting]);

  const logRep = () => {
    haptic();
    const newReps = repsCompleted + 1;
    if (newReps >= (drill?.reps || 1)) {
      // Drill complete
      if (currentDrill + 1 >= totalDrills) {
        setDone(true);
        haptic();
      } else {
        setRepsCompleted(0);
        setCurrentDrill(currentDrill + 1);
        setIsResting(true);
        setRestTime(30);
      }
    } else {
      setRepsCompleted(newReps);
    }
  };

  const skipDrill = () => {
    haptic();
    if (currentDrill + 1 >= totalDrills) {
      setDone(true);
    } else {
      setRepsCompleted(0);
      setCurrentDrill(currentDrill + 1);
    }
  };

  // Done screen
  if (done) {
    return (
      <div style={{
        position: "fixed",
        inset: 0,
        zIndex: 250,
        background: "var(--color-bg)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        paddingLeft: 32,
        paddingRight: 32,
        textAlign: "center",
      }}>
        <div>
          <div style={{ marginBottom: 16 }}><Icon name="trophy" size={64} color="#FF6B35" /></div>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: "var(--color-text)", marginBottom: 8 }}>Workout Complete!</h2>
          <p style={{ fontSize: 15, color: "var(--color-text-sec)", marginBottom: 8 }}>{totalDrills} drills · {formatTime(elapsed)} total</p>
        </div>
        <button onClick={onComplete} style={{
          maxWidth: 300,
          width: "100%",
          padding: "14px 24px",
          borderRadius: 14,
          border: "none",
          background: "var(--color-accent)",
          color: "white",
          fontSize: 16,
          fontWeight: 700,
          cursor: "pointer",
          minHeight: 44,
          marginTop: 32,
        }}>Done</button>
      </div>
    );
  }

  // Rest screen
  if (isResting) {
    return (
      <div style={{
        position: "fixed",
        inset: 0,
        zIndex: 250,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        paddingLeft: 32,
        paddingRight: 32,
        textAlign: "center",
        background: "linear-gradient(135deg, #3B82F6, #2563EB)",
      }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", marginBottom: 8 }}>Rest Period</div>
        <div key={restTime} style={{ fontSize: 80, fontWeight: 900, color: "white", lineHeight: 1 }}>
          {restTime}
        </div>
        <p style={{ fontSize: 15, color: "rgba(255,255,255,0.7)", marginTop: 16, marginBottom: 32 }}>Next: {drills[currentDrill + 1]?.name || "Final drill"}</p>
        <button onClick={() => { setIsResting(false); haptic(); }}
          style={{
            padding: "16px 32px",
            borderRadius: 16,
            background: "white",
            color: "#2563EB",
            fontSize: 17,
            fontWeight: 700,
            border: "none",
            cursor: "pointer",
            minHeight: 44,
            minWidth: 200,
          }}>
          Skip Rest <Icon name="forward" size={14} />
        </button>
      </div>
    );
  }

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 250,
      background: "var(--color-bg)",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingLeft: 24,
        paddingRight: 24,
        paddingTop: 16,
        paddingBottom: 8,
        flexShrink: 0,
      }}>
        <button onClick={onComplete} style={{
          background: "transparent",
          border: "none",
          color: "var(--color-text-sec)",
          fontSize: 15,
          cursor: "pointer",
          minHeight: 44,
          padding: "8px 12px",
        }}>End</button>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)" }}>{currentDrill + 1}/{totalDrills}</div>
        <button onClick={skipDrill} style={{
          background: "transparent",
          border: "none",
          color: "var(--color-text-sec)",
          fontSize: 15,
          cursor: "pointer",
          minHeight: 44,
          padding: "8px 12px",
        }}>Skip <Icon name="forward" size={12} /></button>
      </div>

      {/* Progress bar */}
      <div style={{ paddingLeft: 24, paddingRight: 24, marginBottom: 16, flexShrink: 0 }}>
        <div style={{ height: 8, background: "var(--color-muted)", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ height: "100%", borderRadius: 4, background: "var(--color-accent)", width: `${progress}%`, transition: "width 0.3s ease" }} />
        </div>
      </div>

      {/* Drill info */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        paddingLeft: 32,
        paddingRight: 32,
        textAlign: "center",
      }}>
        <div style={{ fontSize: 11, color: "var(--color-text-sec)", textTransform: "uppercase", marginBottom: 8 }}>{formatTime(elapsed)}</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--color-text)", marginBottom: 8 }}>{drill?.name}</h2>
        <p style={{ fontSize: 13, color: "var(--color-text-sec)", marginBottom: 32, maxWidth: 280 }}>{drill?.description?.substring(0, 100)}...</p>

        {/* Rep counter -- the big circle */}
        <div style={{ position: "relative", width: 180, height: 180 }}>
          {/* Background ring */}
          <svg viewBox="0 0 180 180" style={{ position: "absolute", inset: 0, width: 180, height: 180 }}>
            <circle cx="90" cy="90" r="80" fill="none" stroke="var(--color-muted)" strokeWidth="8" />
            <circle cx="90" cy="90" r="80" fill="none" stroke="var(--color-accent)" strokeWidth="8"
              strokeDasharray={`${(repsCompleted / (drill?.reps || 1)) * 502} 502`}
              strokeLinecap="round"
              style={{ transform: "rotate(-90deg)", transformOrigin: "center", transition: "stroke-dasharray 0.3s ease" }} />
          </svg>
          {/* Center number */}
          <div style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <div key={repsCompleted} style={{ fontSize: 48, fontWeight: 900, color: "var(--color-accent)", lineHeight: 1 }}>
              {repsCompleted}
            </div>
            <div style={{ fontSize: 11, color: "var(--color-text-sec)", marginTop: 4 }}>of {drill?.reps || 0}</div>
          </div>
        </div>
      </div>

      {/* Big tap button */}
      <div style={{ paddingLeft: 24, paddingRight: 24, paddingBottom: 32, flexShrink: 0 }}>
        <button onClick={logRep}
          style={{
            width: "100%",
            padding: "20px 0",
            borderRadius: 16,
            border: "none",
            cursor: "pointer",
            fontSize: 20,
            fontWeight: 700,
            color: "white",
            background: "linear-gradient(135deg, var(--color-accent), var(--color-accent-dark))",
            boxShadow: "0 6px 24px rgba(255,107,53,0.35)",
            minHeight: 64,
          }}>
          Tap to Count Rep
        </button>
        <button onClick={() => setPaused(!paused)}
          style={{
            width: "100%",
            padding: "12px 0",
            marginTop: 8,
            borderRadius: 12,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 700,
            color: "var(--color-text-sec)",
            minHeight: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}>
          {paused ? <><Icon name="play" size={14} /> Resume</> : <><Icon name="pause" size={14} /> Pause</>}
        </button>
      </div>
    </div>
  );
}
