import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("iOS identity matches the existing App Store Connect record", async () => {
  const project = await readFile(new URL("../ios/App/App.xcodeproj/project.pbxproj", import.meta.url), "utf8");
  assert.equal((project.match(/PRODUCT_BUNDLE_IDENTIFIER = "com\.ChrisDavis-courtiq";/g) || []).length, 2);
});

test("paid access is not granted by browser storage", async () => {
  const context = await readFile(new URL("../src/context/AppContext.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(context, /localStorage\.getItem\("courtiq-(?:pro|teamiq)"\)/);
  assert.doesNotMatch(context, /localStorage\.setItem\("courtiq-(?:pro|teamiq)"/);
});
