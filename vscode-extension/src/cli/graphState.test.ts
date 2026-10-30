import assert from "node:assert/strict";
import { test } from "node:test";

import { parseGraphState, statusTotalsFor } from "./graphState.ts";

const response = {
  results: [
    {
      run_id: "run-a",
      root_execution_id: "exec-a",
      status_totals: { SUCCEEDED: 13, RUNNING: 2 },
      failed_execution_ids: [],
      error: null,
    },
    {
      run_id: "run-b",
      root_execution_id: "exec-b",
      status_totals: null,
      failed_execution_ids: null,
      error: "timed out",
    },
  ],
};

test("parseGraphState reads the results array", () => {
  const results = parseGraphState(response);
  assert.equal(results.length, 2);
  assert.equal(results[0].run_id, "run-a");
});

test("statusTotalsFor matches by run id or root execution id", () => {
  const results = parseGraphState(response);
  assert.deepEqual(statusTotalsFor(results, "run-a"), {
    SUCCEEDED: 13,
    RUNNING: 2,
  });
  assert.deepEqual(statusTotalsFor(results, "exec-a"), {
    SUCCEEDED: 13,
    RUNNING: 2,
  });
});

test("statusTotalsFor returns null for an errored or missing run", () => {
  const results = parseGraphState(response);
  assert.equal(statusTotalsFor(results, "run-b"), null);
  assert.equal(statusTotalsFor(results, "missing"), null);
});
