import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

test("release UI has no simulated purchase or fake account-link flow", async () => {
  const [shell, iq, shotLogger, appContext] = await Promise.all([
    readFile(new URL("src/components/Shell.jsx", root), "utf8"),
    readFile(new URL("src/components/iq/IQScreen.jsx", root), "utf8"),
    readFile(new URL("src/components/shots/ShotLogger.jsx", root), "utf8"),
    readFile(new URL("src/context/AppContext.jsx", root), "utf8"),
  ]);
  const releaseUi = [shell, iq, shotLogger, appContext].join("\n");

  assert.doesNotMatch(releaseUi, /Simulated purchase|\$4\.99|\$9\.99|upgradeToPro|courtiq-parent-code|Account Linked!/);
  assert.doesNotMatch(shell, /ParentChildLink|ProUpgradeScreen/);
  assert.match(shell, /case "iq": return <IQScreen \/>/);
  assert.match(shell, /case "heatmap": return <HeatMapScreen \/>/);
  assert.match(iq, /Team collaboration coming soon/);

  await assert.rejects(access(new URL("src/components/pro/ParentChildLink.jsx", root)));
  await assert.rejects(access(new URL("src/components/pro/ProUpgradeScreen.jsx", root)));
});
