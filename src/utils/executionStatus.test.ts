import { describe, expect, it } from "vitest";

import {
  deriveExecutionStatusFromStats,
  getExecutionStatusLabel,
} from "@/utils/executionStatus";

describe("getExecutionStatusLabel", () => {
  it("maps WAITING_FOR_UPSTREAM to the real name", () => {
    expect(getExecutionStatusLabel("WAITING_FOR_UPSTREAM")).toBe(
      "Waiting for upstream",
    );
  });

  it("maps QUEUED to the real name", () => {
    expect(getExecutionStatusLabel("QUEUED")).toBe("Queued");
  });

  it("maps SYSTEM_ERROR to Failed (per current decision)", () => {
    expect(getExecutionStatusLabel("SYSTEM_ERROR")).toBe("Failed");
  });
});

describe("deriveExecutionStatusFromStats", () => {
  it("returns undefined when no stats are present", () => {
    expect(deriveExecutionStatusFromStats(undefined)).toBeUndefined();
  });

  it("returns RUNNING if any child is running", () => {
    expect(deriveExecutionStatusFromStats({ RUNNING: 1, SUCCEEDED: 3 })).toBe(
      "RUNNING",
    );
  });

  it("returns WAITING_FOR_UPSTREAM when present and nothing higher priority exists", () => {
    expect(deriveExecutionStatusFromStats({ WAITING_FOR_UPSTREAM: 2 })).toBe(
      "WAITING_FOR_UPSTREAM",
    );
  });

  it("returns FAILED when SYSTEM_ERROR is present", () => {
    expect(deriveExecutionStatusFromStats({ SYSTEM_ERROR: 1 })).toBe("FAILED");
  });

  it("returns SUCCEEDED when all known nodes are succeeded", () => {
    expect(deriveExecutionStatusFromStats({ SUCCEEDED: 4 })).toBe("SUCCEEDED");
  });
});
