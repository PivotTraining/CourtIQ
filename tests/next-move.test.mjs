import test from "node:test";
import assert from "node:assert/strict";
import { computeNextMove } from "../src/lib/nextMove.mjs";

test("asks a new player to log a first session", () => {
  const move = computeNextMove([]);
  assert.equal(move.screen, "shots");
  assert.match(move.title, /first session/i);
});

test("prioritizes a repeated weak shooting zone", () => {
  const sessions = [{
    type: "practice",
    shot_logs: Array.from({ length: 8 }, (_, index) => ({ zone_id: "left-corner-three", made: index < 2 })),
    game_stats: {},
  }];
  const move = computeNextMove(sessions, { shooting: 70, playmaking: 70, rebounding: 70, defense: 70, efficiency: 70 });
  assert.equal(move.screen, "heatmap");
  assert.match(move.metric, /25%/);
});

test("prioritizes ball security when turnovers dominate recent games", () => {
  const sessions = [
    { type: "game", shot_logs: [], game_stats: { ast: 2, to: 4 } },
    { type: "game", shot_logs: [], game_stats: { ast: 3, to: 4 } },
    { type: "game", shot_logs: [], game_stats: { ast: 1, to: 3 } },
  ];
  const move = computeNextMove(sessions, { shooting: 65, playmaking: 65, rebounding: 65, defense: 65, efficiency: 65 });
  assert.equal(move.screen, "skills");
  assert.match(move.title, /possession/i);
});

test("uses the lowest rating when there is no stronger evidence", () => {
  const sessions = [
    { type: "practice", shot_logs: Array.from({ length: 30 }, () => ({ zone_id: "paint", made: true })), game_stats: {} },
    { type: "practice", shot_logs: Array.from({ length: 30 }, () => ({ zone_id: "right-wing", made: true })), game_stats: {} },
  ];
  const move = computeNextMove(sessions, { shooting: 70, playmaking: 38, rebounding: 60, defense: 62, efficiency: 68 });
  assert.equal(move.screen, "skills");
  assert.match(move.title, /playmaking/i);
});

test("falls back to consistency when the data has no urgent weakness", () => {
  const sessions = Array.from({ length: 6 }, (_, index) => ({
    type: index % 2 ? "game" : "practice",
    shot_logs: Array.from({ length: 10 }, (_, shotIndex) => ({ zone_id: `zone-${index}-${shotIndex}`, made: true })),
    game_stats: { ast: 6, to: 1 },
  }));
  const move = computeNextMove(sessions, { shooting: 70, playmaking: 70, rebounding: 70, defense: 70, efficiency: 70 });
  assert.equal(move.screen, "iq");
  assert.match(move.title, /strongest habit/i);
});
