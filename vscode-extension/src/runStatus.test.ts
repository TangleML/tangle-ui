import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isRunActive,
  overallRunStatus,
  runStatusIcon,
  runStatusLabel,
} from "./runStatus.ts";

test("only statuses that can still change count as active", () => {
  assert.equal(isRunActive("RUNNING"), true);
  assert.equal(isRunActive("QUEUED"), true);
  assert.equal(isRunActive("SUCCEEDED"), false);
  assert.equal(isRunActive("FAILED"), false);
  assert.equal(isRunActive(undefined), false);
});

test("the most severe status with tasks wins", () => {
  assert.equal(overallRunStatus({ SUCCEEDED: 5, FAILED: 1 }), "FAILED");
  assert.equal(overallRunStatus({ SUCCEEDED: 5, RUNNING: 2 }), "RUNNING");
  assert.equal(overallRunStatus({ SUCCEEDED: 5, FAILED: 0 }), "SUCCEEDED");
});

test("unknown statuses fall back to any status with tasks", () => {
  assert.equal(overallRunStatus({ NEW_STATUS: 1 }), "NEW_STATUS");
  assert.equal(overallRunStatus({}), undefined);
  assert.equal(overallRunStatus(null), undefined);
});

test("labels and icons cover known and unknown statuses", () => {
  assert.equal(runStatusLabel("WAITING_FOR_UPSTREAM"), "Waiting for upstream");
  assert.equal(runStatusLabel("NEW_STATUS"), "NEW_STATUS");
  assert.equal(runStatusLabel(undefined), "Unknown");
  assert.equal(runStatusIcon("SUCCEEDED").id, "pass");
  assert.equal(runStatusIcon(undefined).id, "circle-large-outline");
});
