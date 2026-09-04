import test from "node:test";
import assert from "node:assert/strict";
import { buildPrescription } from "../src/lib/prescriptions.mjs";

test("turns a weak shooting zone into a three-part workout", () => {
  const prescription = buildPrescription({
    kind: "weak_zone",
    zoneId: "left-corner-3",
    title: "Own the Left Corner 3",
    confidence: "solid",
    metric: "25% from Left Corner 3",
  });

  assert.equal(prescription.drills.length, 3);
  assert.equal(prescription.drills[0].phase, "Prime");
  assert.equal(prescription.drills[1].phase, "Correct");
  assert.ok(prescription.drills[1].targetZones.includes("left-corner-3"));
  assert.equal(prescription.drills[2].phase, "Transfer");
  assert.equal(prescription.confidence, "solid");
  assert.ok(prescription.totalDuration > 0);
});

test("prescribes ball-handling work when turnovers are the priority", () => {
  const prescription = buildPrescription({
    kind: "ball_security",
    title: "Win the possession battle",
    confidence: "strong",
    metric: "4.0 TO/G · 0.8 A/TO",
  });

  assert.deepEqual(
    prescription.drills.map((drill) => drill.id),
    ["stationary-dribbles", "full-court-handles", "cone-attack"]
  );
  assert.equal(prescription.confidence, "strong");
});

test("does not prescribe before CourtIQ has player data", () => {
  assert.equal(buildPrescription({ kind: "onboarding" }), null);
});
