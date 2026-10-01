import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { safeNextPath, passwordError } from "../src/lib/webAuth.mjs";

test("OAuth accepts local destinations and rejects external or auth-loop destinations", () => {
  assert.equal(safeNextPath("/training?focus=shooting#workout"), "/training?focus=shooting#workout");
  for (const path of [null, "https://other.test", "//other.test", "/\\other.test", "/\t/other.test", "/auth/callback", "/%2e%2e/auth/callback"]) {
    assert.equal(safeNextPath(path), "/dashboard");
  }
});

test("password reset requires a matching password with sufficient length", () => {
  assert.ok(passwordError("short", "short"));
  assert.ok(passwordError("password-long", "different"));
  assert.equal(passwordError("password-long", "password-long"), null);
});

const worker = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
function workerHarness({ offline = false } = {}) {
  const handlers = {};
  const offlinePage = { offline: true };
  const deleted = [];
  const cache = new Map([["/offline.html", offlinePage], ["/logo.svg", { logo: true }]]);
  vm.runInNewContext(worker, {
    URL, Response,
    self: { location: { origin: "https://court.test" }, addEventListener: (name, handler) => { handlers[name] = handler; }, skipWaiting() {}, clients: { claim() {} } },
    clients: {},
    fetch: async () => { if (offline) throw new Error("offline"); return { live: true }; },
    caches: { match: async (key) => cache.get(key), keys: async () => ["courtiq-v1", "courtiq-web-v2", "other-app"], delete: async (key) => { deleted.push(key); }, open: async () => ({ addAll: async () => {} }) },
  });
  function request(path, mode = "cors") {
    let response;
    handlers.fetch({ request: { url: new URL(path, "https://court.test").href, method: "GET", mode }, respondWith(value) { response = value; } });
    return response;
  }
  return { handlers, request, offlinePage, deleted };
}

test("service worker never intercepts auth, API, external, or player-data requests", () => {
  const harness = workerHarness();
  for (const path of ["/api/auth-status", "/auth/callback?code=private", "https://example.supabase.co/rest/v1/players", "/dashboard?_rsc=private"]) {
    assert.equal(harness.request(path), undefined);
  }
});

test("offline navigations return an honest offline page rather than a cached player's page", async () => {
  const harness = workerHarness({ offline: true });
  assert.equal(await harness.request("/dashboard", "navigate"), harness.offlinePage);
  assert.deepEqual(await harness.request("/logo.svg"), { logo: true });
});

test("worker activation removes only older CourtIQ caches", async () => {
  const harness = workerHarness();
  let activation;
  harness.handlers.activate({ waitUntil(value) { activation = value; } });
  await activation;
  assert.deepEqual(harness.deleted, ["courtiq-v1"]);
});
