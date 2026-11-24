import assert from "node:assert/strict";
import { test } from "node:test";

import { normalizeInstanceUrl, parseInstancePresets } from "./instances.ts";

test("normalizeInstanceUrl trims trailing slashes and keeps the origin", () => {
  assert.equal(
    normalizeInstanceUrl("https://oasis.shopify.io/"),
    "https://oasis.shopify.io",
  );
  assert.equal(
    normalizeInstanceUrl("  https://oasis-staging.shopify.io  "),
    "https://oasis-staging.shopify.io",
  );
});

test("normalizeInstanceUrl rejects non-http(s) URLs", () => {
  assert.throws(() => normalizeInstanceUrl("ftp://example.com"));
  assert.throws(() => normalizeInstanceUrl("not a url"));
});

test("parseInstancePresets parses a valid JSON array", () => {
  assert.deepEqual(
    parseInstancePresets(
      '[{"label":"staging","apiUrl":"https://staging.example.com"},{"label":"prod","apiUrl":"https://prod.example.com","uiUrl":"https://ui.example.com"}]',
    ),
    [
      { label: "staging", apiUrl: "https://staging.example.com" },
      {
        label: "prod",
        apiUrl: "https://prod.example.com",
        uiUrl: "https://ui.example.com",
      },
    ],
  );
});

test("parseInstancePresets returns [] for unset or empty input", () => {
  assert.deepEqual(parseInstancePresets(undefined), []);
  assert.deepEqual(parseInstancePresets(""), []);
});

test("parseInstancePresets returns [] for malformed JSON", () => {
  assert.deepEqual(parseInstancePresets("{not json"), []);
});

test("parseInstancePresets returns [] for schema-invalid input", () => {
  assert.deepEqual(parseInstancePresets('{"label":"x"}'), []);
  assert.deepEqual(parseInstancePresets('[{"label":"x"}]'), []);
});
