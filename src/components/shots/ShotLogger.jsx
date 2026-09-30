"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Icon, { Emoji } from "@/components/ui/Icons";
import { useApp } from "@/context/AppContext";
import { COURT_ZONES, ZONE_CATEGORIES } from "@/lib/constants";
import { createSession, insertShot, deleteShot, updateSessionStats, findSessionByJoinCode } from "@/lib/queries";
import { getHeatColor, calcPct } from "@/lib/utils";
import { playSwish, playClank, playTap, playWhistle } from "@/lib/sounds";
import { supabase } from "@/lib/supabase";
import CourtTrackerView from './CourtTrackerView';
import AdvancedSessionReport from './AdvancedSessionReport';

function haptic() {
  if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(15);
}

/* ──────────────────────────────────────────────────────
   LIVE STAT BAR — scrolling ticker at top during game
   ────────────────────────────────────────────────────── */
function LiveStatBar({ shots, gameStats, freeThrows }) {
  const totalFG = shots.length;
  const madeFG = shots.filter((s) => s.made).length;
  const ftMade = freeThrows.filter((f) => f.made).length;
  const ftTotal = freeThrows.length;
  const threes = shots.filter((s) => ZONE_CATEGORIES.threes.includes(s.zone_id));
  const threesMade = threes.filter((s) => s.made).length;
  const totalPts =
    shots.filter((s) => s.made).reduce((sum, s) => {
      const zone = COURT_ZONES.find((z) => z.id === s.zone_id);
      return sum + (zone?.pts || 2);
    }, 0) + ftMade;

  const stats = [
    { label: "PTS", value: totalPts, color: "#FF6B35" },
    { label: "FG", value: `${madeFG}/${totalFG}`, color: "var(--color-text)" },
    { label: "3PT", value: `${threesMade}/${threes.length}`, color: "#8B5CF6" },
    { label: "FT", value: `${ftMade}/${ftTotal}`, color: "#0EA5E9" },
    { label: "AST", value: gameStats.ast, color: "#22C55E" },
    { label: "REB", value: gameStats.reb, color: "#F59E0B" },
    { label: "STL", value: gameStats.stl, color: "#10B981" },
    { label: "BLK", value: gameStats.blk, color: "#6366F1" },
    { label: "TO", value: gameStats.to, color: "#EF4444" },
  ];

  return (
    <div style={{ display: "flex", gap: 12, padding: "8px 16px", overflowX: "auto", flexShrink: 0, WebkitOverflowScrolling: "touch" }}>
      {stats.map((s) => (
        <div key={s.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 36 }}>
          <span style={{ fontSize: 14, fontWeight: 900, color: s.color }}>{s.value || 0}</span>
          <span style={{ fontSize: 8, fontWeight: 700, color: "var(--color-text-sec)", textTransform: "uppercase" }}>{s.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────────────
   EFFICIENCY CALCULATOR
   ────────────────────────────────────────────────────── */
function calcEfficiency(shots, freeThrows, gameStats) {
  const ftMade = freeThrows.filter((f) => f.made).length;
  const madeFG = shots.filter((s) => s.made).length;
  const totalPts = shots.filter((s) => s.made).reduce((sum, s) => {
    const zone = COURT_ZONES.find((z) => z.id === s.zone_id);
    return sum + (zone?.pts || 2);
  }, 0) + ftMade;
  // Basic box-score efficiency tally (not PER or a possession-based rating).
  const missedFG = shots.length - madeFG;
  const missedFT = freeThrows.length - ftMade;
  return totalPts + (gameStats.reb || 0) + (gameStats.ast || 0) + (gameStats.stl || 0) + (gameStats.blk || 0) - missedFG - missedFT - (gameStats.to || 0);
}

/* ──────────────────────────────────────────────────────
   POST-GAME ANALYSIS ENGINE
   ────────────────────────────────────────────────────── */
function generateGameAnalysis(shots, freeThrows, gameStats) {
  const lines = [];
  const totalFG = shots.length;
  const madeFG = shots.filter((s) => s.made).length;
  const fgPct = calcPct(madeFG, totalFG);
  const ftMade = freeThrows.filter((f) => f.made).length;
  const ftPct = calcPct(ftMade, freeThrows.length);
  const eff = calcEfficiency(shots, freeThrows, gameStats);
  const mins = gameStats.min || 0;

  // Points calculation
  const totalPts = shots.filter((s) => s.made).reduce((sum, s) => {
    const zone = COURT_ZONES.find((z) => z.id === s.zone_id);
    return sum + (zone?.pts || 2);
  }, 0) + ftMade;

  // 3PT breakdown
  const threes = shots.filter((s) => ZONE_CATEGORIES.threes.includes(s.zone_id));
  const threesMade = threes.filter((s) => s.made).length;
  const threePct = calcPct(threesMade, threes.length);

  // 2PT breakdown
  const twos = shots.filter((s) => !ZONE_CATEGORIES.threes.includes(s.zone_id) && s.zone_id !== "free-throw");
  const twosMade = twos.filter((s) => s.made).length;
  const twoPct = calcPct(twosMade, twos.length);

  lines.push({ icon: "📊", text: `EFF ${eff}: a basic tally of recorded points, rebounds, assists, steals and blocks, less misses and turnovers. It does not measure every part of your game.`, tag: "Box score" });

  // Shooting
  if (totalFG > 0) {
    if (fgPct >= 55) lines.push({ icon: "🎯", text: `${madeFG}/${totalFG} from the field (${fgPct}%). Review which looks you can create again; this session alone does not establish your usual shooting level.`, tag: "Shooting" });
    else if (fgPct >= 45) lines.push({ icon: "✅", text: `${fgPct}% from the field. Solid efficiency — keep being selective.`, tag: "Efficient" });
    else if (fgPct >= 35) lines.push({ icon: "⚠️", text: `${fgPct}% shooting is below standard. Were you rushing? Get to your spots.`, tag: "Work" });
    else lines.push({ icon: "🧊", text: `Cold shooting night at ${fgPct}%. Don't force it — trust your mechanics.`, tag: "Ice" });
  }

  // 3PT analysis
  if (threes.length >= 3) {
    if (threePct >= 40) lines.push({ icon: "💜", text: `${threesMade}/${threes.length} from deep (${threePct}%). Range was on point tonight.`, tag: "Range" });
    else if (threePct < 25) lines.push({ icon: "🚫", text: `Only ${threePct}% from three. Consider driving or pulling up from mid-range.`, tag: "Adjust" });
  }

  // Free Throws
  if (freeThrows.length >= 3) {
    if (ftPct >= 80) lines.push({ icon: "🧘", text: `${ftPct}% from the line. Ice in your veins at the stripe.`, tag: "Clutch" });
    else if (ftPct < 65) lines.push({ icon: "🎯", text: `Free throw shooting needs work — ${ftPct}% leaves points on the table.`, tag: "Practice" });
  }

  // Playmaking
  if (gameStats.ast > 0 && gameStats.to > 0) {
    const ratio = (gameStats.ast / gameStats.to).toFixed(1);
    if (ratio >= 3) lines.push({ icon: "🧠", text: `${ratio}:1 AST/TO ratio. Elite court vision and decision-making.`, tag: "General" });
    else if (ratio >= 2) lines.push({ icon: "👁️", text: `${ratio}:1 AST/TO. Good playmaking — keep reading the defense.`, tag: "Vision" });
    else lines.push({ icon: "⚠️", text: `${ratio}:1 AST/TO. Review the turnovers for avoidable passes or handling mistakes; points lost cannot be inferred from this box score.`, tag: "Review" });
  } else if (gameStats.ast >= 5) {
    lines.push({ icon: "🎭", text: `${gameStats.ast} dimes with zero turnovers. Floor general masterclass.`, tag: "Dime" });
  }

  // Rebounding
  if (gameStats.reb >= 10) lines.push({ icon: "💪", text: `${gameStats.reb} boards — double-digit rebounding effort. You owned the glass.`, tag: "Beast" });
  else if (gameStats.reb >= 6) lines.push({ icon: "🔄", text: `${gameStats.reb} rebounds. Solid presence — keep crashing.`, tag: "Active" });

  // Defense
  const defImpact = (gameStats.stl || 0) + (gameStats.blk || 0);
  if (defImpact >= 5) lines.push({ icon: "🛡️", text: `${defImpact} combined steals and blocks. Defensive anchor performance.`, tag: "Lockdown" });
  else if (defImpact >= 3) lines.push({ icon: "🔒", text: `${defImpact} steals + blocks. Your defense disrupted their rhythm.`, tag: "Active D" });

  // Per-minute if mins tracked
  if (mins > 0 && totalPts > 0) {
    const ppm = (totalPts / mins).toFixed(1);
    if (ppm >= 0.8) lines.push({ icon: "⚡", text: `${ppm} points per minute. Maximum impact in your minutes.`, tag: "Efficient" });
  }

  // Zone insights
  const zoneBreakdown = COURT_ZONES.map((zone) => {
    const zoneShots = shots.filter((s) => s.zone_id === zone.id);
    return { ...zone, total: zoneShots.length, made: zoneShots.filter((s) => s.made).length };
  }).filter((z) => z.total > 0);

  const hotZones = zoneBreakdown.filter((z) => calcPct(z.made, z.total) >= 55 && z.total >= 2);
  const coldZones = zoneBreakdown.filter((z) => calcPct(z.made, z.total) < 30 && z.total >= 2);

  if (hotZones.length > 0) lines.push({ icon: "🔥", text: `Hot zones: ${hotZones.map((z) => z.label).join(", ")}. Keep attacking these spots.`, tag: "Hot" });
  if (coldZones.length > 0) lines.push({ icon: "❄️", text: `Cold zones: ${coldZones.map((z) => z.label).join(", ")}. Add reps from here in practice.`, tag: "Drill" });

  return { lines, totalPts, eff, fgPct, ftPct, threePct, twoPct, madeFG, totalFG, threesMade, threes: threes.length, twosMade, twos: twos.length, ftMade, ftTotal: freeThrows.length };
}

function generatePracticeAnalysis(shots, freeThrows, gameStats) {
  const lines = [];
  const totalFG = shots.length;
  const madeFG = shots.filter((s) => s.made).length;
  const fgPct = calcPct(madeFG, totalFG);
  const ftMade = freeThrows.filter((f) => f.made).length;
  const ftPct = calcPct(ftMade, freeThrows.length);
  const threes = shots.filter((s) => ZONE_CATEGORIES.threes.includes(s.zone_id));
  const threesMade = threes.filter((s) => s.made).length;
  const threePct = calcPct(threesMade, threes.length);

  // Volume
  const totalReps = totalFG + freeThrows.length;
  if (totalReps >= 100) lines.push({ icon: "🏋️", text: `${totalReps} total reps. Elite work ethic — the volume will pay off.`, tag: "Grind" });
  else if (totalReps >= 50) lines.push({ icon: "⚡", text: `${totalReps} reps. Solid session — consistency builds confidence.`, tag: "Locked" });
  else if (totalReps > 0) lines.push({ icon: "📈", text: `${totalReps} reps. Good start — try to get more volume next session.`, tag: "Build" });

  // Shooting form check
  if (totalFG > 10) {
    if (fgPct >= 60) lines.push({ icon: "✅", text: `${fgPct}% at practice pace. Your mechanics are dialed in. Challenge yourself with game-speed reps.`, tag: "Clean" });
    else if (fgPct >= 45) lines.push({ icon: "🔧", text: `${fgPct}% — decent but push for higher accuracy before adding speed.`, tag: "Tune" });
    else lines.push({ icon: "⚠️", text: `${fgPct}% in practice means something's off mechanically. Slow it down and focus on form.`, tag: "Form" });
  }

  // 3PT practice
  if (threes.length >= 5) {
    if (threePct >= 45) lines.push({ icon: "💜", text: `${threePct}% from three in practice. You're game-ready from deep.`, tag: "Dialed" });
    else lines.push({ icon: "🎯", text: `${threePct}% from three. Keep shooting — repetition builds muscle memory.`, tag: "Reps" });
  }

  // FT practice
  if (freeThrows.length >= 10) {
    if (ftPct >= 85) lines.push({ icon: "🧘", text: `${ftPct}% from the line. Free throw routine is locked in.`, tag: "Money" });
    else lines.push({ icon: "🔁", text: `${ftPct}% free throws. Add 50 FTs to end every practice.`, tag: "Routine" });
  }

  // Zone diversity
  const zonesUsed = new Set(shots.map((s) => s.zone_id)).size;
  if (zonesUsed >= 8) lines.push({ icon: "🗺️", text: `Shot from ${zonesUsed} different zones. Well-rounded scorer's workout.`, tag: "Complete" });
  else if (zonesUsed <= 3 && totalFG > 10) lines.push({ icon: "📍", text: `Only ${zonesUsed} zones. Challenge yourself to shoot from new spots.`, tag: "Expand" });

  // Improvement areas
  const coldZones = COURT_ZONES.map((zone) => {
    const zoneShots = shots.filter((s) => s.zone_id === zone.id);
    return { ...zone, total: zoneShots.length, made: zoneShots.filter((s) => s.made).length };
  }).filter((z) => z.total >= 3 && calcPct(z.made, z.total) < 40);

  if (coldZones.length > 0) {
    lines.push({ icon: "📋", text: `Drill focus for next session: ${coldZones.map((z) => z.label).join(", ")}. Spot up and get 20 reps from each.`, tag: "Next Up" });
  }

  lines.push({ icon: "💡", text: "Great reps translate to game confidence. The work you put in today will show up when it counts.", tag: "Mindset" });

  const totalPts = shots.filter((s) => s.made).reduce((sum, s) => {
    const zone = COURT_ZONES.find((z) => z.id === s.zone_id);
    return sum + (zone?.pts || 2);
  }, 0) + ftMade;

  return { lines, totalPts, fgPct, ftPct, threePct, madeFG, totalFG, threesMade, threes: threes.length, ftMade, ftTotal: freeThrows.length, totalReps: totalFG + freeThrows.length };
}

/* ──────────────────────────────────────────────────────
   SHAREABLE STAT CARD
   ────────────────────────────────────────────────────── */
function ShareCard({ analysis, sessionType, gameStats, mode, onClose }) {
  const cardRef = useRef(null);
  const [copied, setCopied] = useState(false);

  const shareText = () => {
    const lines = [];
    lines.push(`🏀 Court IQ — ${sessionType === "game" ? "Game" : "Practice"} Recap`);
    lines.push("─────────────────");
    if (analysis.totalPts > 0) lines.push(`📊 ${analysis.totalPts} PTS`);
    if (analysis.totalFG > 0) lines.push(`🎯 FG: ${analysis.madeFG}/${analysis.totalFG} (${analysis.fgPct}%)`);
    if (analysis.threes > 0) lines.push(`💜 3PT: ${analysis.threesMade}/${analysis.threes} (${analysis.threePct}%)`);
    if (analysis.ftTotal > 0) lines.push(`🏀 FT: ${analysis.ftMade}/${analysis.ftTotal} (${analysis.ftPct}%)`);
    if (gameStats.ast > 0) lines.push(`👁️ ${gameStats.ast} AST`);
    if (gameStats.reb > 0) lines.push(`💪 ${gameStats.reb} REB`);
    if (gameStats.stl > 0) lines.push(`🔒 ${gameStats.stl} STL`);
    if (gameStats.blk > 0) lines.push(`🛡️ ${gameStats.blk} BLK`);
    if (analysis.eff !== undefined) lines.push(`⚡ EFF: ${analysis.eff}`);
    lines.push("─────────────────");
    lines.push("Tracked with Court IQ 🧠");
    return lines.join("\n");
  };

  const handleShare = async () => {
    const text = shareText();
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch (e) { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-6 animate-fade-in" onClick={onClose}>
      <div className="bg-[#1A1D2E] rounded-3xl p-5 w-full max-w-[340px] shadow-2xl" ref={cardRef} onClick={(e) => e.stopPropagation()}>
        {/* Card Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center"><Icon name="basketball" size={20} color="#FF6B35" /></div>
          <div>
            <div className="text-white font-black text-sm">Court IQ</div>
            <div className="text-white/50 text-[10px] font-semibold uppercase">
              {sessionType === "game" ? "Game" : "Practice"} Recap {mode === "team" ? "· Team" : ""}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {analysis.totalPts > 0 && (
            <div className="bg-white/10 rounded-xl p-2.5 text-center">
              <div className="text-xl font-black text-accent">{analysis.totalPts}</div>
              <div className="text-[8px] text-white/50 font-bold uppercase">PTS</div>
            </div>
          )}
          {analysis.totalFG > 0 && (
            <div className="bg-white/10 rounded-xl p-2.5 text-center">
              <div className="text-xl font-black text-white">{analysis.fgPct}%</div>
              <div className="text-[8px] text-white/50 font-bold uppercase">FG%</div>
            </div>
          )}
          {analysis.threes > 0 && (
            <div className="bg-white/10 rounded-xl p-2.5 text-center">
              <div className="text-xl font-black text-purple">{analysis.threePct}%</div>
              <div className="text-[8px] text-white/50 font-bold uppercase">3PT%</div>
            </div>
          )}
          {gameStats.ast > 0 && (
            <div className="bg-white/10 rounded-xl p-2.5 text-center">
              <div className="text-xl font-black text-success">{gameStats.ast}</div>
              <div className="text-[8px] text-white/50 font-bold uppercase">AST</div>
            </div>
          )}
          {gameStats.reb > 0 && (
            <div className="bg-white/10 rounded-xl p-2.5 text-center">
              <div className="text-xl font-black text-[#F59E0B]">{gameStats.reb}</div>
              <div className="text-[8px] text-white/50 font-bold uppercase">REB</div>
            </div>
          )}
          {analysis.eff !== undefined && (
            <div className="bg-white/10 rounded-xl p-2.5 text-center">
              <div className={`text-xl font-black ${analysis.eff >= 10 ? "text-accent" : analysis.eff >= 0 ? "text-white" : "text-danger"}`}>{analysis.eff}</div>
              <div className="text-[8px] text-white/50 font-bold uppercase">EFF</div>
            </div>
          )}
        </div>

        {/* Branding */}
        <div className="text-center text-[9px] text-white/30 font-semibold mb-3 flex items-center justify-center gap-1">Tracked with Court IQ <Icon name="brain" size={10} color="rgba(255,255,255,0.3)" /></div>

        {/* Share Buttons */}
        <div className="flex gap-2">
          <button onClick={handleShare} className="flex-1 py-3 rounded-xl bg-accent text-white font-bold text-sm border-none cursor-pointer active:scale-[0.96]">
            {copied ? "Copied!" : navigator.share ? "Share Stats" : "Copy Stats"}
          </button>
          <button onClick={onClose} className="py-3 px-5 rounded-xl bg-white/10 text-white/70 font-bold text-sm border-none cursor-pointer active:scale-[0.96]">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────
   SESSION SUMMARY (Post-Game / Post-Practice)
   ────────────────────────────────────────────────────── */
function SessionSummary({ shots, freeThrows, gameStats, sessionType, mode, focus, onDone }) {
  const [showShare, setShowShare] = useState(false);
  const isGame = sessionType === "game";
  const analysis = isGame
    ? generateGameAnalysis(shots, freeThrows, gameStats)
    : generatePracticeAnalysis(shots, freeThrows, gameStats);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "var(--color-bg)", overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "24px 24px", paddingTop: "max(24px, env(safe-area-inset-top, 24px))" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div className="mb-2">{isGame ? <Icon name="trophy" size={36} color="#FF6B35" /> : <Icon name="zap" size={36} color="#F59E0B" />}</div>
          <h2 className="text-2xl font-black text-text">{isGame ? "Game" : "Practice"} Recap</h2>
          <p className="text-xs text-text-sec mt-1">
            {mode === "team" ? "Team Session" : "Individual"} {gameStats.min > 0 ? `· ${gameStats.min} min` : ""}
          </p>
        </div>

        {/* Efficiency Badge (Game only) */}
        {isGame && analysis.eff !== undefined && (
          <div className="text-center mb-5 animate-fade-in-up" style={{ animationDelay: "60ms" }}>
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${analysis.eff >= 10 ? "bg-accent/10 text-accent" : analysis.eff >= 0 ? "bg-muted text-text" : "bg-danger/10 text-danger"}`}>
              <span className="text-sm font-black">EFF: {analysis.eff}</span>
              <span className="text-xs">{analysis.eff >= 20 ? <Icon name="trophy" size={14} /> : analysis.eff >= 10 ? <Icon name="fire" size={14} /> : analysis.eff >= 0 ? <Icon name="zap" size={14} /> : <Icon name="arrowDown" size={14} />}</span>
            </div>
          </div>
        )}

        {/* Shot Breakdown Cards */}
        <div className="grid grid-cols-2 gap-2.5 mb-5 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
          {analysis.totalFG > 0 && (
            <div className="bg-card rounded-2xl p-3.5 text-center shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
              <div className="text-2xl font-black" style={{ color: analysis.fgPct >= 50 ? "#22C55E" : analysis.fgPct >= 40 ? "#FF6B35" : "#EF4444" }}>
                {analysis.fgPct}%
              </div>
              <div className="text-[9px] text-text-sec font-bold uppercase mt-0.5">FG ({analysis.madeFG}/{analysis.totalFG})</div>
            </div>
          )}
          {analysis.threes > 0 && (
            <div className="bg-card rounded-2xl p-3.5 text-center shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
              <div className="text-2xl font-black text-purple">{analysis.threePct}%</div>
              <div className="text-[9px] text-text-sec font-bold uppercase mt-0.5">3PT ({analysis.threesMade}/{analysis.threes})</div>
            </div>
          )}
          {analysis.ftTotal > 0 && (
            <div className="bg-card rounded-2xl p-3.5 text-center shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
              <div className="text-2xl font-black text-[#0EA5E9]">{analysis.ftPct}%</div>
              <div className="text-[9px] text-text-sec font-bold uppercase mt-0.5">FT ({analysis.ftMade}/{analysis.ftTotal})</div>
            </div>
          )}
          {analysis.totalPts > 0 && (
            <div className="bg-card rounded-2xl p-3.5 text-center shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
              <div className="text-2xl font-black text-accent">{analysis.totalPts}</div>
              <div className="text-[9px] text-text-sec font-bold uppercase mt-0.5">TOTAL PTS</div>
            </div>
          )}
        </div>

        {/* Other Stats Row */}
        {(gameStats.ast > 0 || gameStats.reb > 0 || gameStats.stl > 0 || gameStats.blk > 0 || gameStats.to > 0) && (
          <div className="flex justify-around bg-card rounded-2xl py-3 mb-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)] animate-fade-in-up" style={{ animationDelay: "140ms" }}>
            {gameStats.ast > 0 && <div className="text-center"><div className="text-lg font-black text-success">{gameStats.ast}</div><div className="text-[8px] text-text-sec font-bold uppercase">AST</div></div>}
            {gameStats.reb > 0 && <div className="text-center"><div className="text-lg font-black text-[#F59E0B]">{gameStats.reb}</div><div className="text-[8px] text-text-sec font-bold uppercase">REB</div></div>}
            {gameStats.stl > 0 && <div className="text-center"><div className="text-lg font-black text-success">{gameStats.stl}</div><div className="text-[8px] text-text-sec font-bold uppercase">STL</div></div>}
            {gameStats.blk > 0 && <div className="text-center"><div className="text-lg font-black text-[#6366F1]">{gameStats.blk}</div><div className="text-[8px] text-text-sec font-bold uppercase">BLK</div></div>}
            {gameStats.to > 0 && <div className="text-center"><div className="text-lg font-black text-danger">{gameStats.to}</div><div className="text-[8px] text-text-sec font-bold uppercase">TO</div></div>}
            {gameStats.pf > 0 && <div className="text-center"><div className="text-lg font-black text-[#F59E0B]">{gameStats.pf}</div><div className="text-[8px] text-text-sec font-bold uppercase">PF</div></div>}
          </div>
        )}

        <AdvancedSessionReport shots={shots} freeThrows={freeThrows} gameStats={gameStats} sessionType={sessionType} />

        {/* Zone Heatmap */}
        {shots.length > 0 && (
          <div className="mb-5 animate-fade-in-up" style={{ animationDelay: "180ms" }}>
            <h3 className="text-sm font-bold text-text mb-3">Shot Chart</h3>
            <div className="flex flex-col gap-1.5">
              {COURT_ZONES.map((zone) => {
                const zoneShots = shots.filter((s) => s.zone_id === zone.id);
                if (zoneShots.length === 0) return null;
                const made = zoneShots.filter((s) => s.made).length;
                const pct = calcPct(made, zoneShots.length);
                return (
                  <div key={zone.id} className="bg-card rounded-xl p-2.5 flex items-center gap-2.5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: getHeatColor(pct) }}>
                      <span className="text-white text-[9px] font-black">{pct}%</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-bold text-text truncate block">{zone.label}</span>
                    </div>
                    <span className="text-[11px] text-text-sec font-semibold flex-shrink-0">{made}/{zoneShots.length}</span>
                    <div className="h-1.5 w-14 bg-muted rounded-full overflow-hidden flex-shrink-0">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: getHeatColor(pct) }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Focus Check */}
        {focus && (
          <div className="mb-5 animate-fade-in-up" style={{ animationDelay: "210ms" }}>
            <div className="bg-card rounded-2xl p-4 border border-border">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="target" size={16} color="var(--color-text)" />
                <h3 className="text-sm font-bold text-text">Focus Check: {focus}</h3>
              </div>
              <p className="text-[12px] text-text leading-relaxed m-0">
                {focus === "3-Point Range" && (analysis.threePct >= 35 ? `${analysis.threePct}% from three — you delivered on your focus. Keep this range in your game.` : `${analysis.threePct}% from deep — below target. Add 50 spot-up threes to your next practice.`)}
                {focus === "Mid-Range" && (analysis.fgPct >= 45 ? "Solid mid-range performance. Your pull-up game is developing." : "Mid-range needs more reps. Work on pull-ups off the dribble.")}
                {focus === "Finishing" && "Review your paint touches. Were you finishing strong or settling for floaters?"}
                {focus === "Free Throws" && (analysis.ftPct >= 75 ? `${analysis.ftPct}% from the line — clutch focus paid off.` : `${analysis.ftPct}% FT — keep grinding your routine. Consistency comes from repetition.`)}
                {focus === "Playmaking" && (gameStats.ast >= 3 ? `${gameStats.ast} assists — great floor vision tonight.` : "Look for more kick-outs and drive-and-dish opportunities.")}
                {focus === "Defense" && ((gameStats.stl || 0) + (gameStats.blk || 0) >= 2 ? "Defensive impact was felt. Active hands and great positioning." : "Stay disciplined. Slide your feet and contest every shot.")}
                {focus === "Rebounding" && (gameStats.reb >= 5 ? `${gameStats.reb} boards — you battled on the glass.` : "Box out first, then go get the ball. Positioning beats athleticism.")}
              </p>
            </div>
          </div>
        )}

        {/* Court IQ Analysis */}
        {analysis.lines.length > 0 && (
          <div className="mb-5 animate-fade-in-up" style={{ animationDelay: "220ms" }}>
            <h3 className="text-sm font-bold text-text mb-3 flex items-center gap-1.5"><Icon name="brain" size={16} /> Court IQ Analysis</h3>
            <div className="bg-card rounded-2xl p-4 border border-accent/10">
              <div className="flex flex-col gap-3">
                {analysis.lines.map((line, i) => (
                  <div key={i} className="flex gap-2.5 items-start">
                    <span className="flex-shrink-0 mt-0.5"><Emoji e={line.icon} size={16} color="var(--color-text)" /></span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-text leading-relaxed m-0">{line.text}</p>
                    </div>
                    <span className="text-[8px] font-black text-accent/60 uppercase bg-accent/10 px-1.5 py-0.5 rounded-md flex-shrink-0 mt-0.5">
                      {line.tag}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Journal Prompt */}
        <button onClick={() => { onDone(); setTimeout(() => { if (typeof window !== "undefined") window.__COURTIQ_OPEN_JOURNAL?.(); }, 300); }}
          style={{ width: "100%", padding: "14px 0", borderRadius: 14, border: "2px dashed rgba(255,107,53,0.3)", background: "rgba(255,107,53,0.06)", color: "#FF6B35", fontSize: 14, fontWeight: 700, cursor: "pointer", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 48 }}>
          <Icon name="edit" size={16} color="#FF6B35" /> New Journal Entry
        </button>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={() => setShowShare(true)}
            style={{ flex: 1, padding: "16px 0", borderRadius: 16, background: "#1A1D2E", color: "white", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, boxShadow: "0 4px 16px rgba(0,0,0,0.2)", minHeight: 48 }}>
            <Icon name="share" size={14} color="white" /> Share Stats
          </button>
          <button onClick={onDone}
            style={{ flex: 1, padding: "16px 0", borderRadius: 16, background: "#FF6B35", color: "white", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer", minHeight: 48, boxShadow: "0 4px 16px rgba(255,107,53,0.3)" }}>
            Done
          </button>
        </div>
      </div>

      {showShare && (
        <ShareCard
          analysis={analysis}
          sessionType={sessionType}
          gameStats={gameStats}
          mode={mode}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   MAIN GAME TRACKER
   ══════════════════════════════════════════════════════ */
export default function ShotLogger({ onClose, darkMode, onToggleTheme }) {
  const { playerId, refreshData } = useApp();
  const [step, setStep] = useState("setup"); // setup | logging | summary
  const [sessionType, setSessionType] = useState("practice");
  const [mode, setMode] = useState("individual");
  const [session, setSession] = useState(null);
  const [shots, setShots] = useState([]);       // court shots (2PT/3PT with zone)
  const [freeThrows, setFreeThrows] = useState([]); // FTs (no zone)
  const [selectedZone, setSelectedZone] = useState(null);
  const [saving, setSaving] = useState(false);
  const pendingWrite = useRef(false);
  const [saveError, setSaveError] = useState(null); // user-visible save error
  const [tab, setTab] = useState("court"); // court | stats
  const [gameStats, setGameStats] = useState({ ast: 0, reb: 0, stl: 0, blk: 0, to: 0, pf: 0, min: 0 });
  const [undoStack, setUndoStack] = useState([]); // track actions for undo
  const [courtTheme, setCourtTheme] = useState("tan");
  const [focus, setFocus] = useState(""); // pre-session focus
  const [ripple, setRipple] = useState(null); // { zoneId, type: "made"|"missed" }
  const [ending, setEnding] = useState(false);
  const [joinMode, setJoinMode] = useState(false); // joining someone else's session
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joiningSession, setJoiningSession] = useState(false);
  const [teammates, setTeammates] = useState([]); // [{name, shotsAdded}]
  const realtimeRef = useRef(null);

  // ── REALTIME SYNC: subscribe to teammate shots when in a shared session ──
  useEffect(() => {
    if (!session || mode !== "team") return;
    const channel = supabase
      .channel(`courtiq-game-${session.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "shot_logs", filter: `session_id=eq.${session.id}` },
        (payload) => {
          const shot = payload.new;
          if (shot.player_id === playerId) return; // own shots handled locally
          setShots((prev) => {
            if (prev.find((s) => s.id === shot.id)) return prev; // dedupe
            return [...prev, { id: shot.id, zone_id: shot.zone_id, made: shot.made, fromTeammate: true }];
          });
          setTeammates((prev) => {
            const idx = prev.findIndex((t) => t.player_id === shot.player_id);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = { ...updated[idx], shotsAdded: updated[idx].shotsAdded + 1 };
              return updated;
            }
            return [...prev, { player_id: shot.player_id, name: "Teammate", shotsAdded: 1 }];
          });
        }
      )
      .subscribe();
    realtimeRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [session, mode, playerId]);

  const updateStat = (key, delta) => {
    if (pendingWrite.current || ending || (delta < 0 && gameStats[key] <= 0)) return;
    haptic();
    playTap();
    setGameStats((prev) => ({ ...prev, [key]: Math.max(0, prev[key] + delta) }));
    setUndoStack((prev) => [...prev, { type: "stat", key, delta }]);
  };

  const startSession = async () => {
    if (pendingWrite.current) return;
    if (!playerId) {
      setSaveError("No player profile found. Please restart the app.");
      return;
    }
    setSaving(true);
    pendingWrite.current = true;
    setSaveError(null);
    try {
      const s = await createSession(playerId, sessionType, mode);
      setSession(s);
      setStep("logging");
    } catch (err) {
      console.error("Failed to create session:", err);
      setSaveError("Couldn't start session — check your connection and try again.");
    } finally {
      pendingWrite.current = false;
      setSaving(false);
    }
  };

  const joinSession = async () => {
    if (!joinCodeInput.trim()) { setJoinError("Enter a 6-character game code."); return; }
    setJoiningSession(true);
    setJoinError("");
    try {
      const found = await findSessionByJoinCode(joinCodeInput);
      if (!found) {
        setJoinError("Code not found — make sure the game is still active.");
        return;
      }
      setSession(found);
      setSessionType(found.type || "game");
      setMode("team");
      setStep("logging");
    } catch (err) {
      console.error("Join session error:", err);
      setJoinError("Something went wrong. Check your connection.");
    } finally {
      setJoiningSession(false);
    }
  };

  const logShot = useCallback(async (made) => {
    if (pendingWrite.current || !session || !selectedZone) return;
    pendingWrite.current = true;
    haptic();
    // Sound + ripple
    if (made) playSwish(); else playClank();
    setRipple({ zoneId: selectedZone, type: made ? "made" : "missed" });
    setTimeout(() => setRipple(null), 600);
    setSaving(true);
    setSaveError(null);
    const zoneToLog = selectedZone;
    setSelectedZone(null); // clear selection optimistically
    try {
      const shot = await insertShot(session.id, playerId, zoneToLog, made);
      setShots((prev) => [...prev, { id: shot.id, zone_id: zoneToLog, made }]);
      setUndoStack((prev) => [...prev, { type: "shot", id: shot.id }]);
    } catch (err) {
      console.error("Failed to log shot:", err);
      setSaveError("Shot didn't save — check connection.");
    } finally {
      pendingWrite.current = false;
      setSaving(false);
    }
  }, [session, selectedZone, playerId]);

  const logFreeThrow = async (made) => {
    if (pendingWrite.current || !session) return;
    pendingWrite.current = true;
    haptic();
    if (made) playSwish(); else playClank();
    setSaving(true);
    setSaveError(null);
    try {
      const shot = await insertShot(session.id, playerId, "free-throw", made);
      setFreeThrows((prev) => [...prev, { id: shot.id, made }]);
      setUndoStack((prev) => [...prev, { type: "ft", id: shot.id }]);
    } catch (err) {
      console.error("Failed to log FT:", err);
      setSaveError("FT didn't save — check connection.");
    } finally {
      pendingWrite.current = false;
      setSaving(false);
    }
  };

  const undoLast = async () => {
    if (pendingWrite.current || saving || ending || undoStack.length === 0) return;
    pendingWrite.current = true;
    const last = undoStack[undoStack.length - 1];
    setSaving(true);
    setSaveError(null);
    try {
      if (last.type === "shot" || last.type === "ft") await deleteShot(last.id);
      if (last.type === "shot") setShots((prev) => prev.filter((s) => s.id !== last.id));
      else if (last.type === "ft") setFreeThrows((prev) => prev.filter((f) => f.id !== last.id));
      else if (last.type === "stat") setGameStats((prev) => ({ ...prev, [last.key]: Math.max(0, prev[last.key] - (last.delta ?? 1)) }));
      setUndoStack((prev) => prev.slice(0, -1));
    } catch {
      setSaveError("Undo didn't save. The shot is still in your record—please try again.");
    } finally {
      pendingWrite.current = false;
      setSaving(false);
    }
  };

  const endSession = async () => {
    if (pendingWrite.current || saving || ending) return;
    pendingWrite.current = true;
    playWhistle();
    setEnding(true);
    if (session) {
      const ftMade = freeThrows.filter((f) => f.made).length;
      const totalPts = shots.filter((s) => s.made).reduce((sum, s) => {
        const zone = COURT_ZONES.find((z) => z.id === s.zone_id);
        return sum + (zone?.pts || 2);
      }, 0) + ftMade;
      try {
        await updateSessionStats(session.id, { ...gameStats, pts: totalPts, ft_made: ftMade, ft_total: freeThrows.length, focus: focus || null });
      } catch (err) {
        console.error("Failed to save stats:", err);
        setSaveError("Session stats didn't save. Keep this screen open and try ending the session again.");
        setEnding(false);
        pendingWrite.current = false;
        return;
      }
    }
    await refreshData();
    setEnding(false);
    pendingWrite.current = false;
    if (shots.length > 0 || freeThrows.length > 0 || Object.values(gameStats).some((v) => v > 0)) {
      setStep("summary");
    } else {
      onClose();
    }
  };

  /* ── SETUP SCREEN — Flowing multi-step conversation ── */
  const [setupStep, setSetupStep] = useState(0); // 0: mode, 1: type, 2: focus

  if (step === "setup") {
    const steps = [
      // Step 0: Who
      <div key="who" style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: "var(--color-text)", marginBottom: 8, letterSpacing: -0.4 }}>Who's playing?</div>
        <div style={{ fontSize: 13, color: "var(--color-text-sec)", marginBottom: 32 }}>Choose your tracking mode</div>
        <div style={{ display: "flex", gap: 12, width: "100%", maxWidth: 320, flexDirection: "column" }}>
          <div style={{ display: "flex", gap: 12 }}>
            {[
              { id: "individual", icon: "basketball", label: "Just Me", sub: "Track your own stats" },
              { id: "team", icon: "user", label: "Team", sub: "Start a shared game" },
            ].map((m) => (
              <button key={m.id} onClick={() => { haptic(); setMode(m.id); setJoinMode(false); setSetupStep(1); }} style={{
                flex: 1, padding: "20px 12px", borderRadius: 16, border: `2px solid ${mode === m.id && !joinMode ? "var(--color-accent)" : "var(--color-border)"}`,
                cursor: "pointer", textAlign: "center", background: mode === m.id && !joinMode ? "var(--color-accent-light)" : "var(--color-card)",
              }}>
                <div style={{ marginBottom: 8, display: "flex", justifyContent: "center" }}><Icon name={m.icon} size={32} color={mode === m.id && !joinMode ? "var(--color-accent)" : "var(--color-text-sec)"} /></div>
                <div style={{ fontSize: 15, fontWeight: 700, color: mode === m.id && !joinMode ? "var(--color-accent)" : "var(--color-text)" }}>{m.label}</div>
                <div style={{ fontSize: 11, color: "var(--color-text-sec)", marginTop: 3 }}>{m.sub}</div>
              </button>
            ))}
          </div>
          {/* Join an existing game */}
          <button onClick={() => { haptic(); setJoinMode(true); setSetupStep(1); }} style={{
            width: "100%", padding: "16px 12px", borderRadius: 16,
            border: `2px solid ${joinMode ? "#8B5CF6" : "var(--color-border)"}`,
            cursor: "pointer", textAlign: "center",
            background: joinMode ? "rgba(139,92,246,0.08)" : "var(--color-card)",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          }}>
            <Icon name="link" size={20} color={joinMode ? "#8B5CF6" : "var(--color-text-sec)"} />
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: joinMode ? "#8B5CF6" : "var(--color-text)" }}>Join Game</div>
              <div style={{ fontSize: 11, color: "var(--color-text-sec)" }}>Enter a teammate's game code</div>
            </div>
          </button>
        </div>
      </div>,
      // Step 1: What type — OR join code entry
      joinMode ? (
        <div key="join" style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: "var(--color-text)", marginBottom: 8, letterSpacing: -0.4 }}>Enter Game Code</div>
          <div style={{ fontSize: 13, color: "var(--color-text-sec)", marginBottom: 32 }}>Ask the host for their 6-character code</div>
          <input
            value={joinCodeInput}
            onChange={(e) => { setJoinCodeInput(e.target.value.toUpperCase().slice(0, 6)); setJoinError(""); }}
            placeholder="A1B2C3"
            maxLength={6}
            style={{
              width: "100%", maxWidth: 280, padding: "18px 20px", borderRadius: 16, marginBottom: 12,
              border: "2px solid var(--color-border)", background: "var(--color-card)",
              fontSize: 28, fontWeight: 900, textAlign: "center", color: "var(--color-text)",
              letterSpacing: 8, textTransform: "uppercase", outline: "none",
            }}
          />
          {joinError && (
            <div style={{ fontSize: 12, color: "#EF4444", marginBottom: 12, textAlign: "center" }}>{joinError}</div>
          )}
          <button onClick={joinSession} disabled={joiningSession || joinCodeInput.length < 6} style={{
            width: "100%", maxWidth: 280, padding: "16px 24px", borderRadius: 16,
            border: "none", cursor: joiningSession || joinCodeInput.length < 6 ? "not-allowed" : "pointer",
            background: "#8B5CF6", color: "white", fontSize: 16, fontWeight: 800, minHeight: 52,
            opacity: joiningSession || joinCodeInput.length < 6 ? 0.5 : 1,
          }}>
            {joiningSession ? "Connecting..." : "Join Game"}
          </button>
        </div>
      ) : (
        <div key="what" style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: "var(--color-text)", marginBottom: 8, letterSpacing: -0.4 }}>What type?</div>
          <div style={{ fontSize: 13, color: "var(--color-text-sec)", marginBottom: 32 }}>Game or practice session</div>
          <div style={{ display: "flex", gap: 16, width: "100%", maxWidth: 320 }}>
            {[
              { id: "practice", icon: "zap", label: "Practice", sub: "Drills & reps" },
              { id: "game", icon: "trophy", label: "Gametime", sub: "Live competition" },
            ].map((t) => (
              <button key={t.id} onClick={() => { haptic(); setSessionType(t.id); setSetupStep(2); }} style={{
                flex: 1, padding: "24px 12px", borderRadius: 16, border: `2px solid ${sessionType === t.id ? "var(--color-accent)" : "var(--color-border)"}`,
                cursor: "pointer", textAlign: "center", background: sessionType === t.id ? "var(--color-accent-light)" : "var(--color-card)",
              }}>
                <div style={{ marginBottom: 8, display: "flex", justifyContent: "center" }}><Icon name={t.icon} size={36} color={sessionType === t.id ? "var(--color-accent)" : "var(--color-text-sec)"} /></div>
                <div style={{ fontSize: 17, fontWeight: 700, color: sessionType === t.id ? "var(--color-accent)" : "var(--color-text)" }}>{t.label}</div>
                <div style={{ fontSize: 11, color: "var(--color-text-sec)", marginTop: 4 }}>{t.sub}</div>
              </button>
            ))}
          </div>
        </div>
      ),
      // Step 2: Focus
      <div key="focus" style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: "var(--color-text)", marginBottom: 8, letterSpacing: -0.4 }}>Your focus?</div>
        <div style={{ fontSize: 13, color: "var(--color-text-sec)", marginBottom: 24 }}>What are you working on today?</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", width: "100%", maxWidth: 320, justifyContent: "center", marginBottom: 32 }}>
          {["3-Point Range", "Mid-Range", "Finishing", "Free Throws", "Playmaking", "Defense", "Rebounding"].map((f) => (
            <button key={f} onClick={() => { haptic(); setFocus(focus === f ? "" : f); }} style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              padding: "0 16px", height: 44, borderRadius: 12, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 700, whiteSpace: "nowrap",
              background: focus === f ? "var(--color-accent)" : "var(--color-muted)",
              color: focus === f ? "white" : "var(--color-text-sec)",
            }}>
              {f}
            </button>
          ))}
        </div>
        {saveError && (
          <div style={{ width: "100%", maxWidth: 320, padding: "10px 16px", borderRadius: 12, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", marginBottom: 8 }}>
            <p style={{ fontSize: 12, color: "#EF4444", margin: 0, textAlign: "center" }}>{saveError}</p>
          </div>
        )}
        <button onClick={startSession} disabled={saving || !playerId} style={{
          width: "100%", maxWidth: 320, padding: "16px 24px", borderRadius: 16,
          border: "none", cursor: saving || !playerId ? "not-allowed" : "pointer", background: "#FF6B35", color: "white",
          fontSize: 16, fontWeight: 800, minHeight: 52, opacity: saving || !playerId ? 0.5 : 1,
        }}>
          {saving ? "Starting..." : "Let's Go"}
        </button>
        <button onClick={() => { setFocus(""); startSession(); }} disabled={saving || !playerId} style={{
          fontSize: 13, color: "var(--color-text-sec)", fontWeight: 700, background: "none", border: "none", cursor: "pointer", marginTop: 12, minHeight: 44,
        }}>
          Skip focus
        </button>
      </div>,
    ];

    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "var(--color-bg)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header — with safe area for notch */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "max(16px, env(safe-area-inset-top, 16px))", paddingLeft: 24, paddingRight: 24, paddingBottom: 12, flexShrink: 0 }}>
          <button onClick={() => setupStep > 0 ? setSetupStep(setupStep - 1) : onClose()} style={{
            background: "none", border: "none", cursor: "pointer", fontSize: 15, fontWeight: 700, color: "var(--color-accent)", padding: "8px 0", minHeight: 44,
          }}>
            {setupStep > 0 ? "Back" : "Cancel"}
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            {(joinMode ? [0, 1] : [0, 1, 2]).map((i) => (
              <div key={i} style={{
                width: i === setupStep ? 16 : 6, height: 6, borderRadius: 3,
                background: i <= setupStep ? (joinMode ? "#8B5CF6" : "var(--color-accent)") : "var(--color-muted)",
                transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
              }} />
            ))}
          </div>
          <div style={{ width: 64 }} />
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 24px" }}>
          {steps[setupStep]}
        </div>
      </div>
    );
  }

  /* ── SUMMARY SCREEN ── */
  if (step === "summary") {
    return <SessionSummary shots={shots} freeThrows={freeThrows} gameStats={gameStats} sessionType={sessionType} mode={mode} focus={focus} onDone={onClose} />;
  }

  return <CourtTrackerView
    sessionType={sessionType} shots={shots} selectedZone={selectedZone}
    selectZone={zone => { haptic(); setSelectedZone(zone); }}
    gameStats={gameStats} updateStat={updateStat} saving={saving} ending={ending} saveError={saveError}
    tab={tab} setTab={setTab} darkMode={darkMode} onToggleTheme={onToggleTheme}
    courtTheme={courtTheme} setCourtTheme={setCourtTheme}
    undoCount={undoStack.length} undoLast={undoLast} endSession={endSession}
    logShot={logShot} logFreeThrow={logFreeThrow}
    ticker={<LiveStatBar shots={shots} gameStats={gameStats} freeThrows={freeThrows} />}
  />;
}
