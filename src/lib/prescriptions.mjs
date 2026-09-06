import { DRILLS } from "./drills.js";

const FALLBACK_IDS = ["stationary-dribbles", "spot-up-3s", "ft-pressure"];

function findDrill(drills, id) {
  return drills.find((drill) => drill.id === id) || null;
}

function firstMatchingZone(drills, zoneId, exclude = new Set()) {
  return drills.find((drill) => drill.targetZones?.includes(zoneId) && !exclude.has(drill.id)) || null;
}

function workoutIdsForMove(move) {
  if (move?.kind === "ball_security" || (move?.kind === "low_rating" && move?.skill === "playmaking")) {
    return ["stationary-dribbles", "full-court-handles", "cone-attack"];
  }

  if (move?.kind === "low_rating" && move?.skill === "defense") {
    return ["stationary-dribbles", "defensive-slides", "suicides"];
  }

  if (move?.kind === "low_rating" && move?.skill === "rebounding") {
    return ["stationary-dribbles", "defensive-slides", "suicides"];
  }

  if (move?.kind === "low_rating" && move?.skill === "efficiency") {
    return ["stationary-dribbles", "spot-up-3s", "ft-pressure"];
  }

  if (move?.kind === "low_sample") {
    return ["stationary-dribbles", "spot-up-3s", "catch-and-shoot"];
  }

  return FALLBACK_IDS;
}

function phaseReason(index, move) {
  if (index === 0) return "Warm up the handle, feet and decision speed before the corrective work.";
  if (index === 1) {
    if (move?.kind === "weak_zone") return `Attack the exact area CourtIQ flagged: ${move.zoneId}.`;
    if (move?.kind === "ball_security") return "Build control at game speed without giving away possessions.";
    return "Put the highest-priority development area under deliberate reps.";
  }
  return "Finish by transferring the skill into pressure, pace or fatigue.";
}

export function buildPrescription(move, drills = DRILLS) {
  if (!move || move.kind === "onboarding") return null;

  const selected = [];
  const used = new Set();

  const add = (drill, phase) => {
    if (!drill || used.has(drill.id)) return;
    selected.push({
      ...drill,
      phase,
      reason: phaseReason(selected.length, move),
    });
    used.add(drill.id);
  };

  add(findDrill(drills, "stationary-dribbles"), "Prime");

  if (move.kind === "weak_zone" && move.zoneId) {
    add(firstMatchingZone(drills, move.zoneId, used), "Correct");

    const transfer = drills.find((drill) =>
      drill.category === "shooting" && !used.has(drill.id) && drill.difficulty !== "beginner"
    );
    add(transfer, "Transfer");
  } else {
    const ids = workoutIdsForMove(move);
    for (const id of ids) {
      if (selected.length >= 3) break;
      add(findDrill(drills, id), selected.length === 1 ? "Correct" : "Transfer");
    }
  }

  for (const id of FALLBACK_IDS) {
    if (selected.length >= 3) break;
    add(findDrill(drills, id), selected.length === 1 ? "Correct" : "Transfer");
  }

  if (!selected.length) return null;

  return {
    sourceKind: move.kind,
    title: move.kind === "weak_zone" ? `CourtIQ workout: ${move.title}` : `CourtIQ workout: ${move.title}`,
    confidence: move.confidence || "building",
    evidence: move.metric || null,
    drills: selected.slice(0, 3),
    totalDuration: selected.slice(0, 3).reduce((sum, drill) => sum + Number(drill.duration || 0), 0),
    totalReps: selected.slice(0, 3).reduce((sum, drill) => sum + Number(drill.reps || 0), 0),
  };
}
