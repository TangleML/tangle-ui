import { describe, expect, it, vi } from "vitest";

import type { GetContainerExecutionStateResponse } from "@/api/types.gen";

import {
  addDaysAndFormat,
  extractPodName,
  isRecordWithString,
  resolvePodLogsHydrationReplacements,
  resolveRetentionNoticeHydrationReplacements,
  resolveRunningHintHydrationReplacements,
} from "./logsEventsResolvers";

const makeContainerState = (
  overrides: Partial<GetContainerExecutionStateResponse> = {},
): GetContainerExecutionStateResponse => ({
  status: "SUCCEEDED",
  started_at: "2026-03-01T10:00:00.000Z",
  ended_at: "2026-03-01T11:00:00.000Z",
  ...overrides,
});

describe("extractPodName", () => {
  it("extracts pod_name from debug_info top-level", () => {
    const state = makeContainerState({
      debug_info: { pod_name: "worker-abc-123" },
    });
    expect(extractPodName(state)).toBe("worker-abc-123");
  });

  it("extracts pod_name from debug_info.kubernetes", () => {
    const state = makeContainerState({
      debug_info: { kubernetes: { pod_name: "k8s-pod-456" } },
    });
    expect(extractPodName(state)).toBe("k8s-pod-456");
  });

  it("returns null when no debug_info", () => {
    expect(extractPodName(makeContainerState())).toBeNull();
  });

  it("returns null when debug_info has no pod_name", () => {
    const state = makeContainerState({
      debug_info: { other_field: "value" },
    });
    expect(extractPodName(state)).toBeNull();
  });

  it("returns null for undefined containerState", () => {
    expect(extractPodName(undefined)).toBeNull();
  });
});

describe("resolvePodLogsHydrationReplacements", () => {
  it("computes timestamps with padding from metadata", () => {
    const result = resolvePodLogsHydrationReplacements(
      { paddingMinutes: 5 },
      makeContainerState(),
      "worker-abc-123",
    );

    expect(result.podName).toBe("worker-abc-123");
    expect(new Date(result.startTime).toISOString()).toBe(
      "2026-03-01T09:55:00.000Z",
    );
    expect(new Date(result.endTime).toISOString()).toBe(
      "2026-03-01T11:05:00.000Z",
    );
  });

  it("defaults paddingMinutes to 0 if not in metadata", () => {
    const result = resolvePodLogsHydrationReplacements(
      {},
      makeContainerState(),
      "pod-1",
    );

    expect(new Date(result.startTime).toISOString()).toBe(
      "2026-03-01T10:00:00.000Z",
    );
  });

  it("uses current time when ended_at is missing (still running)", () => {
    const before = Date.now();
    const result = resolvePodLogsHydrationReplacements(
      { paddingMinutes: 0 },
      makeContainerState({ ended_at: null }),
      "pod-running",
    );
    const after = Date.now();

    const endMs = new Date(result.endTime).getTime();
    expect(endMs).toBeGreaterThanOrEqual(before);
    expect(endMs).toBeLessThanOrEqual(after + 1000);
  });

  it("uses current time when started_at is missing", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const before = Date.now();
    const result = resolvePodLogsHydrationReplacements(
      { paddingMinutes: 0 },
      makeContainerState({ started_at: null }),
      "pod-unknown",
    );
    const after = Date.now();

    const startMs = new Date(result.startTime).getTime();
    expect(startMs).toBeGreaterThanOrEqual(before);
    expect(startMs).toBeLessThanOrEqual(after + 1000);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("started_at is missing"),
    );

    warnSpy.mockRestore();
  });
});

describe("resolveRetentionNoticeHydrationReplacements", () => {
  it("computes retentionDays and expiryDate", () => {
    const result = resolveRetentionNoticeHydrationReplacements(
      { retentionDays: 30 },
      makeContainerState({ started_at: "2026-03-01T10:00:00.000Z" }),
    );

    expect(result.retentionDays).toBe(30);
    expect(result.expiryDate).toContain("Mar");
    expect(result.expiryDate).toContain("31");
    expect(result.expiryDate).toContain("2026");
  });

  it("defaults retentionDays to 0 and warns if not in metadata", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = resolveRetentionNoticeHydrationReplacements(
      {},
      makeContainerState(),
    );

    expect(result.retentionDays).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("retentionDays missing from metadata"),
    );

    warnSpy.mockRestore();
  });

  it("returns 'Unknown' when started_at is missing", () => {
    const result = resolveRetentionNoticeHydrationReplacements(
      { retentionDays: 7 },
      makeContainerState({ started_at: null }),
    );

    expect(result.expiryDate).toBe("Unknown");
  });
});

describe("resolveRunningHintHydrationReplacements", () => {
  it("returns isRunning=true when RUNNING", () => {
    const result = resolveRunningHintHydrationReplacements("RUNNING");
    expect(result).toEqual({ isRunning: true });
  });

  it("returns isRunning=false when SUCCEEDED", () => {
    const result = resolveRunningHintHydrationReplacements("SUCCEEDED");
    expect(result).toEqual({ isRunning: false });
  });

  it("returns isRunning=false when undefined", () => {
    const result = resolveRunningHintHydrationReplacements(undefined);
    expect(result).toEqual({ isRunning: false });
  });
});

describe("addDaysAndFormat", () => {
  it("adds days and formats as short date", () => {
    const result = addDaysAndFormat("2026-03-01T10:00:00.000Z", 30);
    expect(result).toContain("Mar");
    expect(result).toContain("31");
    expect(result).toContain("2026");
  });

  it("handles zero offset days", () => {
    const result = addDaysAndFormat("2026-06-15T12:00:00.000Z", 0);
    expect(result).toContain("Jun");
    expect(result).toContain("15");
    expect(result).toContain("2026");
  });

  it("rolls into the next month correctly", () => {
    const result = addDaysAndFormat("2026-01-31T12:00:00.000Z", 1);
    expect(result).toContain("Feb");
    expect(result).toContain("1");
    expect(result).toContain("2026");
  });
});

describe("isRecordWithString", () => {
  it("returns true when key exists and is a string", () => {
    expect(isRecordWithString({ name: "Alice" }, "name")).toBe(true);
  });

  it("returns false when key exists but is not a string", () => {
    expect(isRecordWithString({ count: 42 }, "count")).toBe(false);
  });

  it("returns false when key is missing", () => {
    expect(isRecordWithString({ other: "val" }, "name")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isRecordWithString(null, "key")).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isRecordWithString(undefined, "key")).toBe(false);
  });

  it("returns false for a string primitive", () => {
    expect(isRecordWithString("not-an-object", "key")).toBe(false);
  });

  it("returns false when value is an empty string (still true — it is a string)", () => {
    expect(isRecordWithString({ key: "" }, "key")).toBe(true);
  });
});
