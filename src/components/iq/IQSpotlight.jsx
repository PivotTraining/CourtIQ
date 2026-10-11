"use client";
import { useState } from "react";
import { useApp } from "@/context/AppContext";
import "./iq-spotlight.css";

const SKILLS = [
  { key: "shooting", label: "Shooting", mark: "SH" },
  { key: "playmaking", label: "Playmaking", mark: "PL" },
  { key: "efficiency", label: "Efficiency", mark: "EF" },
  { key: "defense", label: "Defense", mark: "DF" },
  { key: "rebounding", label: "Rebounding", mark: "RB" },
];

export function iqReadiness(sessions = []) {
  const confirmed = sessions.filter(s => s?.type === "game" &&
    s.coverage_confirmed === true && s.tracker_status === "completed" &&
    Array.isArray(s.shot_logs) && s.shot_logs.every(shot => typeof shot?.made === "boolean"));
  const shots = confirmed.flatMap(s => s.shot_logs.filter(shot => shot.zone_id !== "free-throw"));
  return { confirmedGames: confirmed.length, recordedAttempts: shots.length,
    sufficient: confirmed.length >= 3 && shots.length >= 30 };
}

export default function IQSpotlight({ ratings, sessions = [], nextMove }) {
  const { setScreen } = useApp();
  const [explain, setExplain] = useState(false);
  const readiness = iqReadiness(sessions);
  const breakdown = SKILLS.map(s => ({
    ...s, value: Number.isFinite(ratings?.[s.key]) ? Math.min(99, Math.max(0, Math.round(ratings[s.key]))) : null,
  }));
  const visible = readiness.sufficient;
  const hasSnapshot = sessions.length > 0 && Number.isFinite(ratings?.overall);
  const move = visible && nextMove ? nextMove : {
    title: readiness.confirmedGames < 3 ? "Build your game sample" : "Track more shots",
    reason: readiness.confirmedGames < 3
      ? "Finish three fully tracked games to unlock a more meaningful development snapshot."
      : "Record at least 30 confirmed game shots before relying on a player snapshot.",
    actionLabel: "Record a game", screen: "train",
  };
  // This deliberately labels ratings as a heuristic and does not claim a calibrated scout grade.
  const best = hasSnapshot ? [...breakdown].filter(s => s.value !== null).sort((a,b)=>b.value-a.value)[0] : null;

  return (
    <section className="iq-spotlight" aria-label="Player IQ snapshot">
      <div className="iq-spotlight-shine" aria-hidden="true" />
      <div className="iq-spotlight-topline">
        <span className="iq-kicker">COURTIQ / PLAYER INTELLIGENCE</span>
        <span className="iq-count">{readiness.confirmedGames} coverage-confirmed game{readiness.confirmedGames === 1 ? "" : "s"}</span>
      </div>
      <div className="iq-scoreband">
        <div className="iq-scorebody">
          <span className="iq-smalltitle">{visible ? "Recorded-data IQ" : hasSnapshot ? "EARLY IQ · LIMITED SAMPLE" : "YOUR IQ IS BUILDING"}</span>
          <div className="iq-bigscore">{hasSnapshot ? ratings.overall : "—"}{hasSnapshot && <span className="iq-scoremax">/99</span>}</div>
          <p className="iq-scorecaption">{visible ? "An estimate based on the stats you logged." : hasSnapshot ? "Provisional indicator. Log complete games for a stronger picture." : "More complete game data brings your progress into focus."}</p>
        </div>
        <div className="iq-orbit" aria-hidden="true">
          <div className="iq-orbit-outer"><div className="iq-orbit-middle"><div className="iq-orbit-inner">IQ</div></div></div>
          <span className="iq-orbit-spark iq-orbit-spark-a" /><span className="iq-orbit-spark iq-orbit-spark-b" />
        </div>
      </div>
      <div className="iq-highlight" role="group" aria-label="Your next move">
        <div className="iq-next-head"><span className="iq-next-light" /> YOUR NEXT MOVE</div>
        <h2>{move.title}</h2>
        <p>{move.reason}</p>
        <button type="button" className="iq-next-button" onClick={() => setScreen(move.screen === "iq" ? "skills" : move.screen)}>
          {move.screen === "iq" ? "Open Skills Lab" : move.actionLabel || "Start training"} <span aria-hidden="true">→</span>
        </button>
      </div>
      {hasSnapshot && (
        <div className="iq-snapshot">
          <div className="iq-snapshot-heading">
            <h3>Game profile</h3>
            <span>{visible && best ? `Leading indicator: ${best.label}` : "Provisional · not a scout grade"}</span>
          </div>
          <div className="iq-skillbars">
            {breakdown.map(s => <div className="iq-skillitem" key={s.key}>
              <div className="iq-skillrow"><span>{s.label}</span><strong>{s.value === null ? "—" : s.value}</strong></div>
              <div className="iq-track"><div className="iq-fill" style={{ "--bar-value": `${s.value ?? 0}%` }} /></div>
            </div>)}
          </div>
        </div>
      )}
      <button type="button" className="iq-explain" onClick={() => setExplain(v=>!v)} aria-expanded={explain}>
        How is my IQ calculated? <span aria-hidden="true">{explain ? "−" : "+"}</span>
      </button>
      {explain && <div className="iq-explanation">
        These ratings are CourtIQ heuristics based on manually recorded games and sessions, not a trained predictive model, scouting grade or independent skill assessment. Missing or incomplete stats can change the results. The snapshot is held until there are at least three confirmed-coverage games and 30 recorded field-goal attempts; longer histories and consistent tracking make comparison more useful. A high or low category value does not prove mastery or weakness.
      </div>}
    </section>
  );
}
