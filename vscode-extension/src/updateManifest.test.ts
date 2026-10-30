import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isExtensionManifest,
  isNewerVersion,
  isTrustedUpdateUrl,
  manifestUrl,
  resolveVsixUrl,
} from "./updateManifest.ts";

test("isNewerVersion compares dotted versions component-wise", () => {
  assert.equal(isNewerVersion("0.0.6", "0.0.5"), true);
  assert.equal(isNewerVersion("0.1.0", "0.0.9"), true);
  assert.equal(isNewerVersion("1.0.0", "0.9.9"), true);
  assert.equal(isNewerVersion("0.0.5", "0.0.5"), false);
  assert.equal(isNewerVersion("0.0.4", "0.0.5"), false);
  assert.equal(isNewerVersion("0.0.5", "0.0.5.1"), false);
});

test("resolveVsixUrl joins relative urls and keeps same-origin absolute ones", () => {
  assert.equal(
    resolveVsixUrl("https://app.example.com", "/extension/x.vsix"),
    "https://app.example.com/extension/x.vsix",
  );
  assert.equal(
    resolveVsixUrl("https://app.example.com/", "extension/x.vsix"),
    "https://app.example.com/extension/x.vsix",
  );
  assert.equal(
    resolveVsixUrl(
      "https://app.example.com",
      "https://app.example.com/extension/x.vsix",
    ),
    "https://app.example.com/extension/x.vsix",
  );
});

test("resolveVsixUrl strips a cross-origin absolute url to the deployment origin", () => {
  assert.equal(
    resolveVsixUrl(
      "https://app.example.com",
      "https://evil.example.com/x.vsix",
    ),
    "https://app.example.com/x.vsix",
  );
});

test("isTrustedUpdateUrl allows https and loopback but refuses plain http", () => {
  assert.equal(isTrustedUpdateUrl("https://app.example.com/x.vsix"), true);
  assert.equal(isTrustedUpdateUrl("http://localhost:3000/x.vsix"), true);
  assert.equal(isTrustedUpdateUrl("http://127.0.0.1:3000/x.vsix"), true);
  assert.equal(isTrustedUpdateUrl("http://app.example.com/x.vsix"), false);
});

test("manifestUrl points at /extension/latest.json without a double slash", () => {
  assert.equal(
    manifestUrl("https://app.example.com/"),
    "https://app.example.com/extension/latest.json",
  );
});

test("isExtensionManifest guards shape", () => {
  assert.equal(
    isExtensionManifest({ version: "0.0.6", filename: "x.vsix", url: "/x" }),
    true,
  );
  assert.equal(isExtensionManifest({ version: "0.0.6" }), false);
  assert.equal(isExtensionManifest(null), false);
  assert.equal(isExtensionManifest("0.0.6"), false);
});
