import { describe, expect, test } from "vitest";

import type { GetGraphExecutionStateResponse } from "@/api/types.gen";
import {
  countInProgressFromStats,
  flattenExecutionStatusStats,
  getExecutionStatusLabel,
  getOverallExecutionStatusFromStats,
  isExecutionComplete,
} from "@/utils/executionStatus";

type ChildExecutionStatusStats =
  GetGraphExecutionStateResponse["child_execution_status_stats"];

describe("getExecutionStatusLabel()", () => {
  test("maps execution/task statuses to the desired display labels", () => {
    expect(getExecutionStatusLabel("QUEUED")).toBe("Queued");
    expect(getExecutionStatusLabel("WAITING_FOR_UPSTREAM")).toBe(
      "Waiting for upstream",
    );
    expect(getExecutionStatusLabel("PENDING")).toBe("Pending");
    expect(getExecutionStatusLabel("RUNNING")).toBe("Running");
    expect(getExecutionStatusLabel("SUCCEEDED")).toBe("Succeeded");
    expect(getExecutionStatusLabel("FAILED")).toBe("Failed");
    expect(getExecutionStatusLabel("SYSTEM_ERROR")).toBe("System error");
    expect(getExecutionStatusLabel("SKIPPED")).toBe("Skipped");
    expect(getExecutionStatusLabel("CANCELLED")).toBe("Cancelled");
    expect(getExecutionStatusLabel("CANCELLING")).toBe("Cancelling");
    expect(getExecutionStatusLabel("INVALID")).toBe("Invalid");
    expect(getExecutionStatusLabel("UNINITIALIZED")).toBe("Uninitialized");
  });

  test("passes through unknown statuses one-to-one", () => {
    expect(getExecutionStatusLabel("SOME_NEW_STATUS")).toBe("SOME_NEW_STATUS");
  });

  test("returns Unknown when status is undefined", () => {
    expect(getExecutionStatusLabel(undefined)).toBe("Unknown");
  });
});

describe("flattenExecutionStatusStats()", () => {
  test("returns empty object for null/undefined input", () => {
    expect(flattenExecutionStatusStats(null)).toEqual({});
    expect(flattenExecutionStatusStats(undefined)).toEqual({});
  });

  test("aggregates stats from multiple child executions", () => {
    const childStats = {
      execution1: { SUCCEEDED: 2, RUNNING: 1 },
      execution2: { SUCCEEDED: 1, FAILED: 1 },
      execution3: { RUNNING: 2, PENDING: 3 },
    };

    expect(flattenExecutionStatusStats(childStats)).toEqual({
      SUCCEEDED: 3,
      RUNNING: 3,
      FAILED: 1,
      PENDING: 3,
    });
  });

  test("handles undefined entries in child stats", () => {
    // Runtime data may have undefined entries even if the type doesn't expect it
    const childStats = {
      execution1: { SUCCEEDED: 1 },
      execution2: undefined,
      execution3: { FAILED: 1 },
    } as unknown as ChildExecutionStatusStats;

    expect(flattenExecutionStatusStats(childStats)).toEqual({
      SUCCEEDED: 1,
      FAILED: 1,
    });
  });

  test("skips zero counts", () => {
    const childStats = {
      execution1: { SUCCEEDED: 1, FAILED: 0 },
    };

    expect(flattenExecutionStatusStats(childStats)).toEqual({
      SUCCEEDED: 1,
    });
  });
});

describe("getOverallExecutionStatusFromStats()", () => {
  test("returns undefined for null/undefined/empty stats", () => {
    expect(getOverallExecutionStatusFromStats(null)).toBeUndefined();
    expect(getOverallExecutionStatusFromStats(undefined)).toBeUndefined();
    expect(getOverallExecutionStatusFromStats({})).toBeUndefined();
    expect(
      getOverallExecutionStatusFromStats({ RUNNING: 0, QUEUED: 0 }),
    ).toBeUndefined();
  });

  test("returns the single status when only one is present", () => {
    expect(getOverallExecutionStatusFromStats({ QUEUED: 2 })).toBe("QUEUED");
    expect(getOverallExecutionStatusFromStats({ SUCCEEDED: 1 })).toBe(
      "SUCCEEDED",
    );
  });

  test("returns the highest priority status present", () => {
    expect(
      getOverallExecutionStatusFromStats({
        SUCCEEDED: 10,
        WAITING_FOR_UPSTREAM: 1,
        SYSTEM_ERROR: 1,
      }),
    ).toBe("SYSTEM_ERROR");

    expect(
      getOverallExecutionStatusFromStats({
        FAILED: 1,
        RUNNING: 5,
      }),
    ).toBe("FAILED");

    expect(
      getOverallExecutionStatusFromStats({
        RUNNING: 1,
        PENDING: 9,
      }),
    ).toBe("RUNNING");
  });

  test("returns raw status values (use getExecutionStatusLabel for display)", () => {
    expect(
      getOverallExecutionStatusFromStats({
        INVALID: 1,
        SUCCEEDED: 5,
      }),
    ).toBe("INVALID");

    expect(
      getOverallExecutionStatusFromStats({
        UNINITIALIZED: 1,
        SUCCEEDED: 5,
      }),
    ).toBe("UNINITIALIZED");
  });
});

describe("countInProgressFromStats()", () => {
  test("counts all in-progress statuses", () => {
    expect(
      countInProgressFromStats({
        RUNNING: 2,
        PENDING: 1,
        QUEUED: 3,
        SUCCEEDED: 10,
      }),
    ).toBe(6);
  });

  test("returns 0 when no in-progress statuses", () => {
    expect(
      countInProgressFromStats({
        SUCCEEDED: 5,
        FAILED: 2,
      }),
    ).toBe(0);
  });

  test("counts all in-progress status types", () => {
    expect(
      countInProgressFromStats({
        RUNNING: 1,
        PENDING: 1,
        QUEUED: 1,
        WAITING_FOR_UPSTREAM: 1,
        CANCELLING: 1,
        UNINITIALIZED: 1,
      }),
    ).toBe(6);
  });
});

describe("isExecutionComplete()", () => {
  test("returns true when all tasks are in terminal states", () => {
    expect(
      isExecutionComplete({
        SUCCEEDED: 5,
        FAILED: 2,
      }),
    ).toBe(true);
  });

  test("returns false when any tasks are in progress", () => {
    expect(
      isExecutionComplete({
        SUCCEEDED: 5,
        RUNNING: 1,
      }),
    ).toBe(false);
  });

  test("returns false for empty stats", () => {
    expect(isExecutionComplete({})).toBe(false);
  });

  test("returns true for cancelled/skipped executions", () => {
    expect(
      isExecutionComplete({
        CANCELLED: 3,
        SKIPPED: 2,
      }),
    ).toBe(true);
  });
});
