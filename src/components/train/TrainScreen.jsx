"use client";

import Icon from "@/components/ui/Icons";
import { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { DRILL_CATEGORIES, DRILLS, generatePracticePlan } from "@/lib/drills";
import { fetchSessionHistory } from "@/lib/queries";
import { computePlayerMemory } from "@/lib/intelligence";
import Card from "@/components/ui/Card";
import SectionDivider from "@/components/ui/SectionDivider";
import WorkoutTimer from "./WorkoutTimer";
import DrillCamera from "./DrillCamera";

const DIFFICULTY_COLORS = { beginner: "#22C55E", intermediate: "#FF6B35", advanced: "#EF4444" };

const EMOJI_ICON_MAP = { "🎯": "target", "💪": "muscle", "🏀": "basketball", "⚡": "zap", "🔥": "fire" };

function extractSteps(description) {
  if (!description) return [];
  // Try to split by numbered patterns like "1." "Step 1:" or sentences ending with periods
  const numbered = description.match(/(?:^|\n)\s*(?:\d+[\.\)]\s*|Step\s+\d+[:.\s]+)([^\n]+)/gi);
  if (numbered && numbered.length >= 2) {
    return numbered.slice(0, 5).map((s) => s.replace(/^\s*\d+[\.\)]\s*|Step\s+\d+[:.\s]+/i, "").trim());
  }
  // Fallback: split into sentences
  const sentences = description.split(/[.!]/).map((s) => s.trim()).filter((s) => s.length > 20);
  return sentences.slice(0, 4);
}

function DrillCard({ drill, compact = false }) {
  const [expanded, setExpanded] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const cat = DRILL_CATEGORIES.find((c) => c.id === drill.category);
  const steps = extractSteps(drill.description);

  const handleCameraClick = (e) => {
    e.stopPropagation();
    setShowCamera(true);
  };

  return (
    <>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          background: "var(--color-card)", borderRadius: 16,
          border: "1px solid var(--color-border)",
          boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
          padding: compact ? 12 : 16, cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: `${cat?.color || "#6B7194"}15`,
          }}>
            <Icon name={EMOJI_ICON_MAP[cat?.icon] || "basketball"} size={18} color={cat?.color || "#6B7194"} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{drill.name}</span>
              {drill.reason && (
                <span style={{ fontSize: 9, fontWeight: 700, color: "#FF6B35", background: "rgba(255,107,53,0.1)", padding: "2px 6px", borderRadius: 4, flexShrink: 0 }}>{drill.reason}</span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{
                fontSize: 10, fontWeight: 700, textTransform: "capitalize",
                padding: "2px 8px", borderRadius: 6,
                color: DIFFICULTY_COLORS[drill.difficulty],
                background: `${DIFFICULTY_COLORS[drill.difficulty]}18`,
                border: `1px solid ${DIFFICULTY_COLORS[drill.difficulty]}30`,
              }}>
                {drill.difficulty}
              </span>
              <span style={{ fontSize: 10, color: "var(--color-text-sec)" }}>{drill.reps} reps</span>
              <span style={{ fontSize: 10, color: "var(--color-text-sec)" }}>~{drill.duration}min</span>
              {cat?.label && (
                <span style={{ fontSize: 9, fontWeight: 700, color: cat.color || "var(--color-text-sec)", background: `${cat.color || "#6B7194"}12`, padding: "2px 6px", borderRadius: 4 }}>
                  {cat.label}
                </span>
              )}
            </div>
          </div>
          <div style={{ flexShrink: 0, marginTop: 4 }}>
            <Icon name="chevDown" size={12} color="var(--color-text-sec)" style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s ease" }} />
          </div>
        </div>

        {expanded && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--color-muted)" }}>

            {/* Full Description */}
            {drill.description && (
              <p style={{ fontSize: 13, color: "var(--color-text-sec)", lineHeight: 1.6, margin: "0 0 12px" }}>
                {drill.description}
              </p>
            )}

            {/* Step-by-step coaching cues */}
            {steps.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "var(--color-text)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                  Steps
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {steps.map((step, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                        background: "var(--color-accent)", color: "white",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 9, fontWeight: 900, marginTop: 1,
                      }}>
                        {i + 1}
                      </div>
                      <span style={{ fontSize: 12, color: "var(--color-text-sec)", lineHeight: 1.5 }}>{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Key Focus pill */}
            {cat && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "var(--color-text)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                  Key Focus
                </div>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  background: `${cat.color || "#6B7194"}15`,
                  color: cat.color || "#6B7194",
                  borderRadius: 10, padding: "6px 12px",
                  fontSize: 12, fontWeight: 700,
                }}>
                  <Icon name={EMOJI_ICON_MAP[cat.icon] || "basketball"} size={14} color={cat.color || "#6B7194"} />
                  {cat.label}
                </span>
              </div>
            )}

            {/* Coaching tip */}
            {drill.videoTip && (
              <div style={{
                background: "rgba(255,107,53,0.06)", borderRadius: 10, padding: "10px 12px",
                borderLeft: "3px solid var(--color-accent)", marginBottom: 12,
              }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "var(--color-accent)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
                  Coaching Tip
                </div>
                <p style={{ fontSize: 12, color: "var(--color-text-sec)", lineHeight: 1.5, margin: 0, fontStyle: "italic" }}>
                  {drill.videoTip}
                </p>
              </div>
            )}

            {/* Target Zones */}
            {drill.targetZones && drill.targetZones.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "var(--color-text)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                  Target Zones
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {drill.targetZones.map((tz) => (
                    <span key={tz} style={{ fontSize: 10, background: "var(--color-muted)", color: "var(--color-text-sec)", padding: "3px 10px", borderRadius: 6, fontWeight: 600 }}>{tz}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Camera Mode Button */}
            <button
              onClick={handleCameraClick}
              style={{
                width: "100%", marginTop: 4,
                padding: "11px 16px", borderRadius: 12,
                background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)",
                color: "#22C55E", fontSize: 13, fontWeight: 700,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                minHeight: 44,
              }}
            >
              <span style={{ fontSize: 16 }}>🎥</span> Camera Mode
            </button>
          </div>
        )}
      </div>

      {showCamera && (
        <DrillCamera drill={drill} onClose={() => setShowCamera(false)} />
      )}
    </>
  );
}

function getDifficultyForAge(age) {
  if (!age) return ["beginner", "intermediate", "advanced"];
  if (age <= 11) return ["beginner"];
  if (age <= 14) return ["beginner", "intermediate"];
  if (age <= 17) return ["beginner", "intermediate", "advanced"];
  return ["beginner", "intermediate", "advanced"];
}

export default function TrainScreen() {
  const { playerId, player } = useApp();
  const { playerProfile } = useAuth();
  const [tab, setTab] = useState("plan"); // plan | drills
  const [category, setCategory] = useState("all");
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeWorkout, setActiveWorkout] = useState(null);

  useEffect(() => {
    if (!playerId) { setLoading(false); return; }
    fetchSessionHistory(playerId).then((sessions) => {
      if (sessions.length > 0) {
        const memory = computePlayerMemory(sessions);
        const generated = generatePracticePlan(memory.weakZones);
        setPlan(generated);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [playerId]);

  const playerAge = playerProfile?.age || player?.age;
  const allowedDifficulties = getDifficultyForAge(playerAge);
  const ageDrills = DRILLS.filter((d) => allowedDifficulties.includes(d.difficulty));
  const filteredDrills = category === "all" ? ageDrills : ageDrills.filter((d) => d.category === category);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ height: 40, background: "var(--color-muted)", borderRadius: 12 }} />
        <div style={{ height: 128, background: "var(--color-muted)", borderRadius: 16 }} />
        <div style={{ height: 128, background: "var(--color-muted)", borderRadius: 16 }} />
      </div>
    );
  }

  return (
    <div>
      {/* Tabs */}
      <div
        style={{
          display: "flex",
          background: "var(--color-muted)",
          borderRadius: 12,
          padding: 3,
          marginBottom: 16,
          gap: 3,
        }}
      >
        {[
          { id: "plan", label: "My Plan", icon: "clipboard" },
          { id: "drills", label: "All Drills", icon: "dumbbell" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1,
              padding: "10px 8px",
              borderRadius: 10,
              border: "none",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.2s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              background: tab === t.id ? "var(--color-card)" : "transparent",
              color: tab === t.id ? "var(--color-accent)" : "var(--color-text-sec)",
              boxShadow: tab === t.id ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
            }}
          >
            <Icon name={t.icon} size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* Age context */}
      {playerAge && (
        <div
          style={{
            background: "var(--color-muted)",
            borderRadius: 12,
            padding: "8px 16px",
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: 11, color: "var(--color-text-sec)" }}>
            Drills for{" "}
            <strong style={{ color: "var(--color-text)" }}>{playerAge}yr old</strong>{" "}
            · {allowedDifficulties.join(", ")} level
          </span>
        </div>
      )}

      {/* MY PLAN TAB */}
      {tab === "plan" && (
        <div>
          {plan && plan.drills.length > 0 ? (
            <>
              {/* Practice Plan Header Card */}
              <div
                style={{
                  background: "linear-gradient(135deg, rgba(255,107,53,0.1), rgba(255,107,53,0.05))",
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 16,
                  border: "1px solid rgba(255,107,53,0.1)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 8,
                  }}
                >
                  <h3
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "var(--color-text)",
                      margin: 0,
                    }}
                  >
                    Today's Practice Plan
                  </h3>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: "var(--color-accent)",
                      background: "rgba(255,107,53,0.1)",
                      padding: "2px 8px",
                      borderRadius: 8,
                    }}
                  >
                    ~{plan.totalDuration} min
                  </span>
                </div>
                <p
                  style={{
                    fontSize: 12,
                    color: "var(--color-text-sec)",
                    margin: 0,
                    lineHeight: 1.5,
                  }}
                >
                  Built from your Court IQ data — targeting your weak zones and
                  building on strengths.
                </p>
              </div>

              {/* Drill List with Step Numbers */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                {plan.drills.map((drill, i) => (
                  <div
                    key={drill.id}
                    style={{
                      display: "flex",
                      gap: 12,
                      alignItems: "flex-start",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        flexShrink: 0,
                        minWidth: 24,
                      }}
                    >
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: "50%",
                          background: "var(--color-accent)",
                          color: "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 10,
                          fontWeight: 900,
                        }}
                      >
                        {i + 1}
                      </div>
                      {i < plan.drills.length - 1 && (
                        <div
                          style={{
                            width: 2,
                            flex: 1,
                            background: "rgba(255,107,53,0.2)",
                            marginTop: 4,
                            minHeight: 20,
                          }}
                        />
                      )}
                    </div>
                    <div
                      style={{ flex: 1, minWidth: 0, paddingBottom: 8 }}
                    >
                      <DrillCard drill={drill} compact />
                    </div>
                  </div>
                ))}
              </div>

              {/* Start Workout Button */}
              <button
                onClick={() => setActiveWorkout(plan.drills)}
                style={{
                  width: "100%",
                  marginTop: 16,
                  padding: "14px 24px",
                  borderRadius: 14,
                  background: "var(--color-accent)",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 700,
                  border: "none",
                  cursor: "pointer",
                  minHeight: 44,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  boxShadow: "0 2px 8px rgba(255,107,53,0.25)",
                }}
              >
                <Icon name="play" size={14} /> Start This Workout
              </button>
            </>
          ) : (
            <div
              style={{
                textAlign: "center",
                padding: "40px 0",
              }}
            >
              <div style={{ marginBottom: 12 }}>
                <Icon name="clipboard" size={40} color="#6B7194" />
              </div>
              <h3
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "var(--color-text)",
                  marginBottom: 4,
                  marginTop: 0,
                }}
              >
                No plan yet
              </h3>
              <p
                style={{
                  fontSize: 13,
                  color: "var(--color-text-sec)",
                  maxWidth: 260,
                  margin: "0 auto",
                  lineHeight: 1.5,
                }}
              >
                Log a few sessions and Court IQ will build a personalized
                practice plan based on your weak spots.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Active Workout Timer */}
      {activeWorkout && (
        <WorkoutTimer drills={activeWorkout} onComplete={() => setActiveWorkout(null)} />
      )}

      {/* ALL DRILLS TAB */}
      {tab === "drills" && (
        <div>
          {/* Category Filter */}
          <div
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 16,
              overflowX: "auto",
              paddingBottom: 4,
              WebkitOverflowScrolling: "touch",
            }}
          >
            <button
              onClick={() => setCategory("all")}
              style={{
                flexShrink: 0,
                padding: "8px 14px",
                borderRadius: 12,
                fontSize: 12,
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
                minHeight: 36,
                background: category === "all" ? "var(--color-accent)" : "var(--color-muted)",
                color: category === "all" ? "#fff" : "var(--color-text-sec)",
              }}
            >
              All
            </button>
            {DRILL_CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategory(c.id)}
                style={{
                  flexShrink: 0,
                  padding: "8px 14px",
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 700,
                  border: "none",
                  cursor: "pointer",
                  minHeight: 36,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  background: category === c.id ? "var(--color-accent)" : "var(--color-muted)",
                  color: category === c.id ? "#fff" : "var(--color-text-sec)",
                }}
              >
                <Icon name={EMOJI_ICON_MAP[c.icon] || "basketball"} size={14} /> {c.label}
              </button>
            ))}
          </div>

          {/* Drill List */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {filteredDrills.map((drill) => (
              <DrillCard key={drill.id} drill={drill} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
