import test from "node:test";
import assert from "node:assert/strict";
import { buildTrainingPrescription, identifyDevelopmentFocus } from "../src/lib/prescriptions.mjs";

const drills = [
  { id: "shot-1", name: "Corner Shooting", category: "shooting", level: "intermediate", duration: 8, reps: 20, tags: ["corner", "shooting", "form"] },
  { id: "shot-2", name: "Form Shooting", category: "shooting", level: "beginner", duration: 6, reps: 30, tags: ["form", "fundamentals"] },
  { id: "handle-1", name: "Pressure Handles", category: "ball-handling", level: "intermediate", duration: 6, reps: 20, tags: ["handles", "pressure"] },
  { id: "pass-1", name: "Passing Reads", category: "passing", level: "intermediate", duration: 7, reps: 20, tags: ["passing", "decision"] },
  { id: "def-1", name: "Closeout Footwork", category: "defense", level: "intermediate", duration: 6, reps: 16, tags: ["footwork"] },
  { id: "reb-1", name: "Pursuit Rebounding", category: "rebounding", level: "intermediate", duration: 7, reps: 18, tags: ["rebounding"] },
];

test("identifies a repeated weak shooting zone", () => {
  const sessions = [{
    type: "practice",
    shot_logs: Array.from({ length: 8 }, (_, index) => ({ zone_id: "left-corner-three", made: index < 2 })),
    game_stats: {},
  }];
  const focus = identifyDevelopmentFocus(sessions, null);
  assert.equal(focus.type, "shooting-zone");
  assert.equal(focus.categories[0], "shooting");
  assert.match(focus.evidence, /25%/);
});

test("turnovers prescribe ball-handling and passing work", () => {
  const sessions = [
    { type: "game", shot_logs: [], game_stats: { ast: 2, to: 4 } },
    { type: "game", shot_logs: [], game_stats: { ast: 1, to: 4 } },
    { type: "game", shot_logs: [], game_stats: { ast: 2, to: 3 } },
  ];
  const prescription = buildTrainingPrescription({ sessions, drills, age: 14 });
  assert.equal(prescription.type, "ball-security");
  assert.ok(prescription.drills.some((drill) => drill.category === "ball-handling"));
  assert.ok(prescription.drills.some((drill) => drill.category === "passing"));
});

test("low defense rating selects defensive work when stronger evidence is absent", () => {
  const sessions = [
    { type: "practice", shot_logs: Array.from({ length: 30 }, () => ({ zone_id: "paint", made: true })), game_stats: {} },
    { type: "practice", shot_logs: Array.from({ length: 30 }, () => ({ zone_id: "right-wing", made: true })), game_stats: {} },
  ];
  const prescription = buildTrainingPrescription({
    sessions,
    ratings: { shooting: 70, playmaking: 70, rebounding: 70, defense: 35, efficiency: 70 },
    drills,
    age: 16,
  });
  assert.equal(prescription.type, "rating");
  assert.equal(prescription.drills[0].category, "defense");
});

test("age gating excludes advanced drills for younger players", () => {
  const ageDrills = [
    { id: "b", name: "Beginner Handle", category: "ball-handling", level: "beginner", duration: 5, reps: 20, tags: ["fundamentals"] },
    { id: "a", name: "Advanced Handle", category: "ball-handling", level: "advanced", duration: 5, reps: 20, tags: ["fundamentals"] },
  ];
  const prescription = buildTrainingPrescription({ sessions: [], drills: ageDrills, age: 10 });
  assert.deepEqual(prescription.drills.map((drill) => drill.id), ["b"]);
});
