"use client";

import { useState, useCallback, useRef } from "react";
import Icon, { Emoji } from "@/components/ui/Icons";
import { useApp } from "@/context/AppContext";
import { COURT_ZONES, ZONE_CATEGORIES } from "@/lib/constants";
import { createSession, insertShot, deleteShot, updateSessionStats } from "@/lib/queries";
import { getHeatColor, calcPct } from "@/lib/utils";
import { playSwish, playClank, playTap, playWhistle } from "@/lib/sounds";

function haptic() {
  if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(15);
}

/* ──────────────────────────────────────────────────────
   STAT BUTTON — big chunky tap targets
   ────────────────────────────────────────────────────── */
function StatBtn({ icon, label, value, color, onTap }) {
  return (
    <button onClick={() => { haptic(); onTap(); }} style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: 6, borderRadius: 16, border: `2px solid ${color}40`, cursor: "pointer",
      background: `${color}18`, padding: "18px 8px", minHeight: 110, width: "100%",
      transition: "transform 0.15s ease", WebkitTapHighlightColor: "transparent",
    }}>
      <Icon name={icon} size={28} color={color} />
      <span style={{ fontSize: 12, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1, color }}>{label}</span>
      {value > 0 && (
        <span style={{ fontSize: 18, fontWeight: 900, color, background: "rgba(255,255,255,0.2)", borderRadius: 20, padding: "2px 14px" }}>
          {value}
        </span>
      )}
    </button>
  );
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
    { label: "FG", value: `${madeFG}/${totalFG}`, color: "#1A1D2E" },
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
  // NBA Efficiency = PTS + REB + AST + STL + BLK - Missed FG - Missed FT - TO
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

  // Efficiency rating
  if (eff >= 20) lines.push({ icon: "👑", text: "Elite efficiency rating. You dominated every aspect of the game.", tag: "MVP" });
  else if (eff >= 10) lines.push({ icon: "🔥", text: "Strong efficiency. Your all-around game was a positive force.", tag: "Impact" });
  else if (eff >= 0) lines.push({ icon: "⚡", text: "Neutral efficiency. Some good moments — tighten up the turnovers and missed shots.", tag: "Solid" });
  else lines.push({ icon: "📉", text: "Negative efficiency. The missed shots and turnovers cost you. Focus on high-percentage plays.", tag: "Rebuild" });

  // Shooting
  if (totalFG > 0) {
    if (fgPct >= 55) lines.push({ icon: "🎯", text: `${fgPct}% from the field — you couldn't miss. Shot selection was elite.`, tag: "Sniper" });
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
    else lines.push({ icon: "⚠️", text: `${ratio}:1 AST/TO. Protect the ball — every turnover is 2+ points lost.`, tag: "Careful" });
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
      <div className="bg-gradient-to-br from-[#1A1D2E] to-[#2D1B0E] rounded-3xl p-5 w-full max-w-[340px] shadow-2xl" ref={cardRef} onClick={(e) => e.stopPropagation()}>
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
            <div className="bg-gradient-to-br from-[#EFF6FF] to-[#DBEAFE] rounded-2xl p-4 border border-[#93C5FD]/20">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="target" size={16} color="#1E40AF" />
                <h3 className="text-sm font-bold text-[#1E40AF]">Focus Check: {focus}</h3>
              </div>
              <p className="text-[12px] text-[#1E3A8A] leading-relaxed m-0">
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
            <div className="bg-gradient-to-br from-[#FFF7ED] to-[#FFF0E8] rounded-2xl p-4 border border-accent/10">
              <div className="flex flex-col gap-3">
                {analysis.lines.map((line, i) => (
                  <div key={i} className="flex gap-2.5 items-start">
                    <span className="flex-shrink-0 mt-0.5"><Emoji e={line.icon} size={16} color="#9A3412" /></span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-[#9A3412] leading-relaxed m-0">{line.text}</p>
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
export default function ShotLogger({ onClose }) {
  const { playerId, refreshData } = useApp();
  const [step, setStep] = useState("setup"); // setup | logging | summary
  const [sessionType, setSessionType] = useState("practice");
  const [mode, setMode] = useState("individual");
  const [session, setSession] = useState(null);
  const [shots, setShots] = useState([]);       // court shots (2PT/3PT with zone)
  const [freeThrows, setFreeThrows] = useState([]); // FTs (no zone)
  const [selectedZone, setSelectedZone] = useState(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("court"); // court | stats
  const [gameStats, setGameStats] = useState({ ast: 0, reb: 0, stl: 0, blk: 0, to: 0, pf: 0, min: 0 });
  const [undoStack, setUndoStack] = useState([]); // track actions for undo
  const [courtTheme, setCourtTheme] = useState("tan");
  const [focus, setFocus] = useState(""); // pre-session focus
  const [ripple, setRipple] = useState(null); // { zoneId, type: "made"|"missed" }

  const [ending, setEnding] = useState(false);

  const updateStat = (key, delta) => {
    haptic();
    playTap();
    setGameStats((prev) => ({ ...prev, [key]: Math.max(0, prev[key] + delta) }));
    if (delta > 0) setUndoStack((prev) => [...prev, { type: "stat", key }]);
  };

  const startSession = async () => {
    setSaving(true);
    try {
      const s = await createSession(playerId, sessionType, mode);
      setSession(s);
      setStep("logging");
    } catch (err) {
      console.error("Failed to create session:", err);
    } finally {
      setSaving(false);
    }
  };

  const logShot = useCallback(async (made) => {
    if (!session || !selectedZone) return;
    haptic();
    // Sound + ripple
    if (made) playSwish(); else playClank();
    setRipple({ zoneId: selectedZone, type: made ? "made" : "missed" });
    setTimeout(() => setRipple(null), 600);
    setSaving(true);
    try {
      const shot = await insertShot(session.id, playerId, selectedZone, made);
      setShots((prev) => [...prev, { id: shot.id, zone_id: selectedZone, made }]);
      setUndoStack((prev) => [...prev, { type: "shot", id: shot.id }]);
      setSelectedZone(null);
    } catch (err) {
      console.error("Failed to log shot:", err);
    } finally {
      setSaving(false);
    }
  }, [session, selectedZone, playerId]);

  const logFreeThrow = async (made) => {
    if (!session) return;
    haptic();
    if (made) playSwish(); else playClank();
    setSaving(true);
    try {
      const shot = await insertShot(session.id, playerId, "free-throw", made);
      setFreeThrows((prev) => [...prev, { id: shot.id, made }]);
      setUndoStack((prev) => [...prev, { type: "ft", id: shot.id }]);
    } catch (err) {
      console.error("Failed to log FT:", err);
    } finally {
      setSaving(false);
    }
  };

  const undoLast = async () => {
    if (undoStack.length === 0) return;
    const last = undoStack[undoStack.length - 1];
    if (last.type === "shot") {
      try { await deleteShot(last.id); } catch (e) {}
      setShots((prev) => prev.filter((s) => s.id !== last.id));
    } else if (last.type === "ft") {
      try { await deleteShot(last.id); } catch (e) {}
      setFreeThrows((prev) => prev.filter((f) => f.id !== last.id));
    } else if (last.type === "stat") {
      setGameStats((prev) => ({ ...prev, [last.key]: Math.max(0, prev[last.key] - 1) }));
    }
    setUndoStack((prev) => prev.slice(0, -1));
  };

  const endSession = async () => {
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
      }
    }
    await refreshData();
    setEnding(false);
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
        <div style={{ display: "flex", gap: 16, width: "100%", maxWidth: 320 }}>
          {[
            { id: "individual", icon: "basketball", label: "Just Me", sub: "Track your own stats" },
            { id: "team", icon: "user", label: "Team", sub: "Track a team game" },
          ].map((m) => (
            <button key={m.id} onClick={() => { haptic(); setMode(m.id); setSetupStep(1); }} style={{
              flex: 1, padding: "24px 12px", borderRadius: 16, border: `2px solid ${mode === m.id ? "var(--color-accent)" : "var(--color-border)"}`,
              cursor: "pointer", textAlign: "center", background: mode === m.id ? "var(--color-accent-light)" : "var(--color-card)",
            }}>
              <div style={{ marginBottom: 8, display: "flex", justifyContent: "center" }}><Icon name={m.icon} size={36} color={mode === m.id ? "var(--color-accent)" : "var(--color-text-sec)"} /></div>
              <div style={{ fontSize: 17, fontWeight: 700, color: mode === m.id ? "var(--color-accent)" : "var(--color-text)" }}>{m.label}</div>
              <div style={{ fontSize: 11, color: "var(--color-text-sec)", marginTop: 4 }}>{m.sub}</div>
            </button>
          ))}
        </div>
      </div>,
      // Step 1: What
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
      </div>,
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
        <button onClick={startSession} disabled={saving} style={{
          width: "100%", maxWidth: 320, padding: "16px 24px", borderRadius: 16,
          border: "none", cursor: "pointer", background: "#FF6B35", color: "white",
          fontSize: 16, fontWeight: 800, minHeight: 52, opacity: saving ? 0.5 : 1,
        }}>
          {saving ? "Starting..." : "Let's Go"}
        </button>
        <button onClick={() => { setFocus(""); startSession(); }} disabled={saving} style={{
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
            {[0, 1, 2].map((i) => (
              <div key={i} style={{
                width: i === setupStep ? 16 : 6, height: 6, borderRadius: 3,
                background: i <= setupStep ? "var(--color-accent)" : "var(--color-muted)",
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

  const COURT_THEMES = {
    tan: { bg: "#E8D5B7", line: "#C4A87A", border: "#D4BE96", label: "Court" },
    gray: { bg: "#D6D8DE", line: "#A0A4B0", border: "#BFC2CC", label: "Gray" },
  };
  const ct = COURT_THEMES[courtTheme];

  /* ── LOGGING SCREEN ── */
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "#1A1D2E", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header — with safe area for notch */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "max(12px, env(safe-area-inset-top, 12px))", paddingLeft: 20, paddingRight: 20, paddingBottom: 4, flexShrink: 0 }}>
        <button onClick={endSession} disabled={ending} style={{
          padding: "8px 16px", borderRadius: 12, background: "rgba(239,68,68,0.2)", color: "#FF6B6B",
          fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer", opacity: ending ? 0.6 : 1, minHeight: 40,
        }}>
          {ending ? "Saving..." : "End"}
        </button>
        <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.8)", display: "flex", alignItems: "center", gap: 6 }}>
          {mode === "team" && <Icon name="user" size={14} color="rgba(255,255,255,0.8)" />}
          <Icon name={sessionType === "game" ? "trophy" : "zap"} size={14} color="rgba(255,255,255,0.8)" />
          {sessionType === "game" ? "Gametime" : "Practice"}
        </span>
        <button onClick={undoLast} disabled={undoStack.length === 0} style={{
          padding: "8px 16px", borderRadius: 12, background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)",
          fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer", opacity: undoStack.length === 0 ? 0.3 : 1, minHeight: 40,
        }}>
          <Icon name="undo" size={14} color="rgba(255,255,255,0.6)" /> Undo
        </button>
      </div>

      {/* Live Stats Ticker */}
      <LiveStatBar shots={shots} gameStats={gameStats} freeThrows={freeThrows} />

      {/* Tabs + Theme Toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 24px 8px", flexShrink: 0 }}>
        <div style={{ display: "flex", flex: 1, background: "rgba(255,255,255,0.1)", borderRadius: 12, padding: 3 }}>
          {["court", "stats"].map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: "10px 0", borderRadius: 10, border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer",
              background: tab === t ? "white" : "transparent",
              color: tab === t ? "#1A1D2E" : "rgba(255,255,255,0.5)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
            }}>
              <Icon name={t === "court" ? "basketball" : "barChart"} size={14} color={tab === t ? "#1A1D2E" : "rgba(255,255,255,0.5)"} />
              {t === "court" ? "Shot Chart" : "Game Stats"}
            </button>
          ))}
        </div>
        {tab === "court" && (
          <button onClick={() => setCourtTheme(courtTheme === "tan" ? "gray" : "tan")} style={{
            width: 36, height: 36, borderRadius: 12, border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", background: ct.bg,
          }}>
            <Icon name="paint" size={16} color="#1A1D2E" />
          </button>
        )}
      </div>

      {tab === "court" ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
          {/* Court — hardwood texture */}
          <div style={{ padding: "0 24px", flexShrink: 0 }}>
            <div style={{ position: "relative", width: "100%", paddingBottom: "80%", borderRadius: 20, overflow: "hidden", background: ct.bg, border: `2px solid ${ct.border}`, boxShadow: "inset 0 2px 8px rgba(0,0,0,0.06)" }}>
              <svg viewBox="0 0 500 400" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0.6 }}>
                <rect x="25" y="10" width="450" height="380" fill="none" stroke={ct.line} strokeWidth="2" rx="4" />
                <path d="M 60 380 L 60 300 Q 60 80 250 45 Q 440 80 440 300 L 440 380" fill="none" stroke={ct.line} strokeWidth="2" />
                <rect x="160" y="230" width="180" height="160" fill="none" stroke={ct.line} strokeWidth="2" rx="2" />
                <circle cx="250" cy="230" r="55" fill="none" stroke={ct.line} strokeWidth="1.5" strokeDasharray="6 4" />
                <circle cx="250" cy="360" r="7" fill="none" stroke={ct.line} strokeWidth="2" />
                <rect x="222" y="366" width="56" height="3" fill={ct.line} rx="1.5" />
                <path d="M 220 380 Q 220 335 250 326 Q 280 335 280 380" fill="none" stroke={ct.line} strokeWidth="1.5" />
              </svg>
              {COURT_ZONES.filter((z) => z.id !== "free-throw").map((zone) => {
                const isSelected = selectedZone === zone.id;
                const zoneShots = shots.filter((s) => s.zone_id === zone.id);
                const zoneMade = zoneShots.filter((s) => s.made).length;
                const zoneTotal = zoneShots.length;
                const zonePct = zoneTotal > 0 ? Math.round((zoneMade / zoneTotal) * 100) : -1;
                return (
                  <div key={zone.id} onClick={() => { haptic(); setSelectedZone(isSelected ? null : zone.id); }}
                    style={{
                      position: "absolute", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%",
                      left: `${zone.x}%`, top: `${zone.y}%`, transform: "translate(-50%, -50%)",
                      width: isSelected ? 52 : 44, height: isSelected ? 52 : 44,
                      background: zonePct >= 0 ? getHeatColor(zonePct) : "rgba(30,30,50,0.35)",
                      border: isSelected ? "3px solid #FF6B35" : "2px solid rgba(255,255,255,0.5)",
                      boxShadow: isSelected ? "0 0 24px rgba(255,107,53,0.5)" : "0 2px 8px rgba(0,0,0,0.15)",
                      zIndex: isSelected ? 10 : 1,
                      transition: "all 0.2s cubic-bezier(0.34,1.56,0.64,1)",
                    }}>
                    <span style={{ fontWeight: 900, color: "white", fontSize: 11, textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>
                      {zoneTotal > 0 ? `${zoneMade}/${zoneTotal}` : zone.label.split(" ")[0]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Shot Buttons */}
          <div style={{ padding: "12px 24px 0", flexShrink: 0 }}>
            {selectedZone ? (
              <div>
                <div style={{ textAlign: "center", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>
                  {COURT_ZONES.find((z) => z.id === selectedZone)?.label}
                  <span style={{ marginLeft: 4, color: "#FF6B35" }}>({COURT_ZONES.find((z) => z.id === selectedZone)?.pts}PT)</span>
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <button onClick={() => logShot(true)} disabled={saving}
                    style={{ flex: 1, padding: "16px 0", borderRadius: 16, background: "#22C55E", color: "white", fontSize: 16, fontWeight: 900, border: "none", cursor: "pointer", opacity: saving ? 0.5 : 1, boxShadow: "0 4px 16px rgba(34,197,94,0.4)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 52 }}>
                    <Icon name="check" size={16} color="white" /> Made
                  </button>
                  <button onClick={() => logShot(false)} disabled={saving}
                    style={{ flex: 1, padding: "16px 0", borderRadius: 16, background: "#EF4444", color: "white", fontSize: 16, fontWeight: 900, border: "none", cursor: "pointer", opacity: saving ? 0.5 : 1, boxShadow: "0 4px 16px rgba(239,68,68,0.4)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 52 }}>
                    <Icon name="x" size={16} color="white" /> Missed
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ textAlign: "center", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>Free Throws</div>
                <div style={{ display: "flex", gap: 12 }}>
                  <button onClick={() => logFreeThrow(true)} disabled={saving}
                    style={{ flex: 1, padding: "14px 0", borderRadius: 16, background: "rgba(34,197,94,0.2)", color: "#4ADE80", fontSize: 14, fontWeight: 900, border: "2px solid rgba(34,197,94,0.3)", cursor: "pointer", opacity: saving ? 0.5 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 48 }}>
                    <Icon name="check" size={14} color="#4ADE80" /> Made FT
                  </button>
                  <button onClick={() => logFreeThrow(false)} disabled={saving}
                    style={{ flex: 1, padding: "14px 0", borderRadius: 16, background: "rgba(239,68,68,0.2)", color: "#FCA5A5", fontSize: 14, fontWeight: 900, border: "2px solid rgba(239,68,68,0.3)", cursor: "pointer", opacity: saving ? 0.5 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 48 }}>
                    <Icon name="x" size={14} color="#FCA5A5" /> Missed FT
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quick Stats — BIG buttons filling remaining space */}
          <div style={{ flex: 1, padding: "12px 24px 20px", minHeight: 0 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, minHeight: 180 }}>
              {[
                { key: "ast", label: "AST", icon: "eye", color: "#22C55E" },
                { key: "reb", label: "REB", icon: "refresh", color: "#F59E0B" },
                { key: "stl", label: "STL", icon: "lock", color: "#10B981" },
                { key: "blk", label: "BLK", icon: "shield", color: "#6366F1" },
                { key: "to", label: "TO", icon: "zap", color: "#EF4444" },
                { key: "pf", label: "PF", icon: "hand", color: "#F59E0B" },
              ].map((s) => (
                <button key={s.key} onClick={() => updateStat(s.key, 1)}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 16, border: `2px solid ${s.color}40`, background: `${s.color}15`, cursor: "pointer", minHeight: 85 }}>
                  <Icon name={s.icon} size={28} color={s.color} />
                  <span style={{ fontSize: 14, fontWeight: 900, color: s.color }}>{s.label}</span>
                  {gameStats[s.key] > 0 && (
                    <span style={{ fontSize: 20, fontWeight: 900, color: s.color, background: "rgba(255,255,255,0.2)", borderRadius: 20, padding: "2px 14px" }}>{gameStats[s.key]}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Stats Tab */
        <div className="flex-1 px-6 pt-3 pb-5 overflow-y-auto min-h-0">
          <div className="grid grid-cols-3 gap-3 mb-4">
            <StatBtn icon="👁️" label="Assist" value={gameStats.ast} color="#22C55E" onTap={() => updateStat("ast", 1)} />
            <StatBtn icon="🔄" label="Rebound" value={gameStats.reb} color="#F59E0B" onTap={() => updateStat("reb", 1)} />
            <StatBtn icon="🔒" label="Steal" value={gameStats.stl} color="#10B981" onTap={() => updateStat("stl", 1)} />
            <StatBtn icon="🛡️" label="Block" value={gameStats.blk} color="#6366F1" onTap={() => updateStat("blk", 1)} />
            <StatBtn icon="💥" label="Turnover" value={gameStats.to} color="#EF4444" onTap={() => updateStat("to", 1)} />
            <StatBtn icon="🖐️" label="Foul" value={gameStats.pf} color="#F59E0B" onTap={() => updateStat("pf", 1)} />
          </div>

          {/* Minutes */}
          <div className="bg-white/10 rounded-2xl p-5">
            <h3 className="text-xs font-bold text-white/40 uppercase mb-3">Minutes Played</h3>
            <div className="flex items-center justify-center gap-5">
              <button onClick={() => updateStat("min", -1)} disabled={gameStats.min <= 0}
                className="w-14 h-14 rounded-xl bg-white/10 text-white/60 text-2xl font-bold border-none cursor-pointer active:scale-[0.93] disabled:opacity-30">
                -
              </button>
              <span className="text-5xl font-black text-white min-w-[70px] text-center">{gameStats.min}</span>
              <button onClick={() => updateStat("min", 1)}
                className="w-14 h-14 rounded-xl bg-accent text-white text-2xl font-bold border-none cursor-pointer active:scale-[0.93]">
                +
              </button>
            </div>
            <div className="flex gap-2 mt-4 justify-center">
              {[5, 10, 20, 32].map((v) => (
                <button key={v} onClick={() => setGameStats((prev) => ({ ...prev, min: v }))}
                  className={`px-5 py-2 rounded-lg text-sm font-bold border-none cursor-pointer active:scale-[0.95] ${gameStats.min === v ? "bg-accent text-white" : "bg-white/10 text-white/50"}`}>
                  {v} min
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom padding */}
      <div className="h-4 flex-shrink-0" />
    </div>
  );
}
