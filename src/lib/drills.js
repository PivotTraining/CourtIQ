/* ══════════════════════════════════════════════════════
   COURT IQ DRILL LIBRARY
   Built-in basketball drills organized by category.
   Each drill has reps, description, and target zones.
   ══════════════════════════════════════════════════════ */

export const DRILL_CATEGORIES = [
  { id: "shooting", label: "Shooting", icon: "target", color: "#FF6B35" },
  { id: "finishing", label: "Finishing", icon: "muscle", color: "#22C55E" },
  { id: "freeThrows", label: "Free Throws", icon: "basketball", color: "#0EA5E9" },
  { id: "ballHandling", label: "Ball Handling", icon: "zap", color: "#8B5CF6" },
  { id: "conditioning", label: "Conditioning", icon: "fire", color: "#EF4444" },
];

export const DRILLS = [
  // ── SHOOTING ──
  {
    id: "spot-up-3s",
    category: "shooting",
    name: "Spot-Up 3s",
    description: "5 shots from each of the 5 three-point zones. Focus on balance, follow-through, and consistent release point.",
    reps: 25,
    duration: 10,
    targetZones: ["left-corner-3", "left-wing-3", "top-key-3", "right-wing-3", "right-corner-3"],
    difficulty: "beginner",
  },
  {
    id: "catch-and-shoot",
    category: "shooting",
    name: "Catch & Shoot",
    description: "Partner passes or self-toss. Catch, square up, shoot in one motion. Emphasize footwork — 1-2 step or hop into your shot.",
    reps: 20,
    duration: 8,
    targetZones: ["left-wing-3", "top-key-3", "right-wing-3"],
    difficulty: "intermediate",
  },
  {
    id: "pull-up-mid",
    category: "shooting",
    name: "Pull-Up Mid-Range",
    description: "Dribble from the top, pull up at each elbow and mid-range spot. Game-speed — no walking into shots.",
    reps: 20,
    duration: 10,
    targetZones: ["left-elbow", "right-elbow", "left-mid", "right-mid"],
    difficulty: "intermediate",
  },
  {
    id: "off-screen-3s",
    category: "shooting",
    name: "Off-Screen 3s",
    description: "Simulate coming off a screen. Sprint to the cone, plant, receive the pass, and fire. Alternate sides.",
    reps: 20,
    duration: 12,
    targetZones: ["left-wing-3", "right-wing-3", "top-key-3"],
    difficulty: "advanced",
  },
  {
    id: "step-back-jumper",
    category: "shooting",
    name: "Step-Back Jumper",
    description: "Attack the defender with 2-3 dribbles, create separation with a step-back, and rise up. Both directions.",
    reps: 16,
    duration: 10,
    targetZones: ["left-elbow", "right-elbow", "left-wing-3", "right-wing-3"],
    difficulty: "advanced",
  },

  // ── FINISHING ──
  {
    id: "mikan-drill",
    category: "finishing",
    name: "Mikan Drill",
    description: "Alternate layups from each side of the basket without letting the ball touch the ground. Right hand on the right, left hand on the left.",
    reps: 30,
    duration: 5,
    targetZones: ["left-block", "right-block"],
    difficulty: "beginner",
  },
  {
    id: "reverse-layups",
    category: "finishing",
    name: "Reverse Layups",
    description: "Drive baseline, finish on the opposite side of the rim with a reverse. Both sides. Focus on touch.",
    reps: 16,
    duration: 8,
    targetZones: ["left-block", "right-block"],
    difficulty: "intermediate",
  },
  {
    id: "floater-drill",
    category: "finishing",
    name: "Floater / Runner",
    description: "Attack from the wing, get into the lane, and finish with a one-foot floater before reaching the big. Soft touch.",
    reps: 16,
    duration: 8,
    targetZones: ["paint", "free-throw"],
    difficulty: "intermediate",
  },
  {
    id: "euro-step",
    category: "finishing",
    name: "Euro Step Finishes",
    description: "Drive hard, gather, take a long lateral step to avoid the shot-blocker, and finish. Alternate approach angles.",
    reps: 12,
    duration: 8,
    targetZones: ["paint", "left-block", "right-block"],
    difficulty: "advanced",
  },

  // ── FREE THROWS ──
  {
    id: "ft-routine-50",
    category: "freeThrows",
    name: "50 Free Throws",
    description: "Shoot 50 free throws with your full routine. Same dribbles, same breath, same follow-through every time. Track your makes.",
    reps: 50,
    duration: 15,
    targetZones: ["free-throw"],
    difficulty: "beginner",
  },
  {
    id: "ft-pressure",
    category: "freeThrows",
    name: "Pressure Free Throws",
    description: "Sprint baseline to baseline, then immediately shoot 2 FTs. Simulates game fatigue. 10 sets of 2.",
    reps: 20,
    duration: 15,
    targetZones: ["free-throw"],
    difficulty: "intermediate",
  },

  // ── BALL HANDLING ──
  {
    id: "stationary-dribbles",
    category: "ballHandling",
    name: "Stationary Dribbles",
    description: "Crossovers, between the legs, behind the back — 30 seconds each. Pound the ball. Eyes up. Low base.",
    reps: 6,
    duration: 5,
    difficulty: "beginner",
  },
  {
    id: "full-court-handles",
    category: "ballHandling",
    name: "Full Court Handles",
    description: "Dribble baseline to baseline using a different move each trip: crossover, hesitation, in-and-out, spin, behind-the-back.",
    reps: 10,
    duration: 8,
    difficulty: "intermediate",
  },
  {
    id: "2-ball-dribbling",
    category: "ballHandling",
    name: "Two-Ball Dribbling",
    description: "Dribble two balls simultaneously — same rhythm, alternating rhythm, one high/one low. Develops weak hand.",
    reps: 6,
    duration: 8,
    difficulty: "advanced",
  },
  {
    id: "cone-attack",
    category: "ballHandling",
    name: "Cone Attack Series",
    description: "Set 5 cones in a line. Attack each cone with a different move. Game speed. Finish with a pull-up or layup.",
    reps: 10,
    duration: 10,
    difficulty: "intermediate",
  },

  // ── CONDITIONING ──
  {
    id: "suicides",
    category: "conditioning",
    name: "Court Suicides",
    description: "Sprint to the free throw line and back, half court and back, far free throw and back, full court and back. 30 sec rest between sets.",
    reps: 5,
    duration: 10,
    difficulty: "intermediate",
  },
  {
    id: "defensive-slides",
    category: "conditioning",
    name: "Defensive Slides",
    description: "Slide baseline to baseline in defensive stance. Stay low, hands active. 4 trips = 1 set.",
    reps: 4,
    duration: 8,
    difficulty: "beginner",
  },
  {
    id: "17s",
    category: "conditioning",
    name: "17s (Sideline to Sideline)",
    description: "Sprint sideline to sideline 17 times in under 1 minute. Rest 1 minute. The classic basketball conditioning test.",
    reps: 3,
    duration: 8,
    difficulty: "advanced",
  },
];

// Generate a practice plan from weak zones
export function generatePracticePlan(weakZones, allDrills = DRILLS) {
  const plan = [];
  const used = new Set();

  // Always start with ball handling warm-up
  const warmup = allDrills.find((d) => d.id === "stationary-dribbles");
  if (warmup) { plan.push({ ...warmup, reason: "Warm-up" }); used.add(warmup.id); }

  // Add drills targeting weak zones
  for (const zone of weakZones) {
    const matching = allDrills.filter((d) =>
      d.targetZones?.some((tz) => tz === zone.id) && !used.has(d.id)
    );
    if (matching.length > 0) {
      const drill = matching[0];
      plan.push({ ...drill, reason: `Improve ${zone.label} (${zone.pct}%)` });
      used.add(drill.id);
    }
  }

  // Fill with shooting if plan is short
  if (plan.length < 4) {
    const fillers = allDrills.filter((d) => d.category === "shooting" && !used.has(d.id));
    for (const f of fillers.slice(0, 4 - plan.length)) {
      plan.push({ ...f, reason: "Sharpen your shot" });
      used.add(f.id);
    }
  }

  // Always end with free throws
  const ftDrill = allDrills.find((d) => d.id === "ft-routine-50" && !used.has(d.id));
  if (ftDrill) plan.push({ ...ftDrill, reason: "End with free throws" });

  // Add conditioning at the end
  const conditioning = allDrills.find((d) => d.id === "suicides" && !used.has(d.id));
  if (conditioning) plan.push({ ...conditioning, reason: "Conditioning finish" });

  const totalDuration = plan.reduce((sum, d) => sum + (d.duration || 0), 0);
  return { drills: plan, totalDuration };
}
