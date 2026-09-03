import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const project = await readFile(new URL("../ios/App/App.xcodeproj/project.pbxproj", import.meta.url), "utf8");
const plist = await readFile(new URL("../ios/App/App/Info.plist", import.meta.url), "utf8");

assert.equal((project.match(/PRODUCT_BUNDLE_IDENTIFIER = "com\.ChrisDavis-courtiq";/g) || []).length, 2,
  "Debug and Release must use the existing App Store Connect bundle ID");
assert.equal((project.match(/CURRENT_PROJECT_VERSION = 65;/g) || []).length, 2,
  "Debug and Release build numbers must be 65");
assert.equal((project.match(/IPHONEOS_DEPLOYMENT_TARGET = 15\.0;/g) || []).length >= 2, true,
  "The app target must support iOS 15+");
assert.match(plist, /<key>NSCameraUsageDescription<\/key>/,
  "Camera features require an iOS purpose string");

console.log("Native release configuration verified.");
