import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const authSource = await readFile(new URL("../src/lib/firebase.js", import.meta.url), "utf8");
const callbackSource = await readFile(new URL("../src/components/auth/AuthCallback.jsx", import.meta.url), "utf8");

test("Google OAuth uses an explicit browser redirect", () => {
  assert.match(authSource, /skipBrowserRedirect:\s*true/);
  assert.match(authSource, /window\.location\.assign\(data\.url\)/);
  assert.match(authSource, /\/auth\/callback\?next=%2Fdashboard/);
});

test("web auth no longer depends on Capacitor", () => {
  assert.doesNotMatch(authSource, /@capacitor\//);
  assert.doesNotMatch(authSource, /window\.Capacitor/);
  assert.doesNotMatch(authSource, /com\.pivottraining\.courtiq/);
});

test("OAuth callback exchanges the code and lands in dashboard", () => {
  assert.match(callbackSource, /exchangeCodeForSession\(code\)/);
  assert.match(callbackSource, /return "\/dashboard"/);
  assert.match(callbackSource, /window\.location\.replace\(next\)/);
});

test("OAuth callback surfaces provider and exchange errors", () => {
  assert.match(callbackSource, /error_description/);
  assert.match(callbackSource, /error\.message/);
});
