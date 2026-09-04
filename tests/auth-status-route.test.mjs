import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../src/app/api/auth-status/route.js", import.meta.url),
  "utf8"
);

test("auth status never exposes the Supabase key or URL in its response", () => {
  assert.match(source, /\{ status, auth, reason, checkedAt:/);
  assert.doesNotMatch(source, /NextResponse\.json\([^)]*key/);
  assert.doesNotMatch(source, /NextResponse\.json\([^)]*url/);
});

test("auth status reports missing or invalid configuration as degraded", () => {
  assert.match(source, /missing_configuration/);
  assert.match(source, /invalid_configuration/);
  assert.match(source, /status === "ok" \? 200 : 503/);
});

test("auth status checks the Supabase auth health endpoint with timeout", () => {
  assert.match(source, /\/auth\/v1\/health/);
  assert.match(source, /headers: \{ apikey: key \}/);
  assert.match(source, /setTimeout\(\(\) => controller\.abort\(\), 5000\)/);
  assert.match(source, /cache: "no-store"/);
});
