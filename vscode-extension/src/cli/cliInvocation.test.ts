import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildCliEnv,
  formatCommandLine,
  parseArgsJson,
  shellQuote,
} from "./cliInvocation.ts";

test("buildCliEnv targets the deployment without leaking a bearer token", () => {
  assert.deepEqual(buildCliEnv({ apiBaseUrl: "http://localhost:8000" }), {
    TANGLE_API_BASE_URL: "http://localhost:8000",
    TANGLE_DEPLOY_SOURCE: "tangent",
  });
});

test("shellQuote leaves safe tokens bare and quotes the rest", () => {
  assert.equal(shellQuote("pipeline-run"), "pipeline-run");
  assert.equal(shellQuote("/a/b_c.yaml"), "/a/b_c.yaml");
  assert.equal(shellQuote("my pipeline.yaml"), "'my pipeline.yaml'");
  assert.equal(shellQuote(""), "''");
  assert.equal(shellQuote("it's"), `'it'\\''s'`);
});

test("formatCommandLine joins the binary and quoted args", () => {
  assert.equal(
    formatCommandLine("tangle-deploy", [
      "pipeline-run",
      "submit",
      "my pipeline.yaml",
    ]),
    "tangle-deploy pipeline-run submit 'my pipeline.yaml'",
  );
});

test("parseArgsJson normalizes an object and rejects non-objects", () => {
  assert.equal(parseArgsJson(""), "{}");
  assert.equal(parseArgsJson('{"date":"2024-01-01"}'), '{"date":"2024-01-01"}');
  assert.throws(() => parseArgsJson("[1,2]"), /JSON object/);
  assert.throws(() => parseArgsJson('"x"'), /JSON object/);
  assert.throws(() => parseArgsJson("{bad"));
});
