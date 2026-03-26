import { describe, expect, it, vi } from "vitest";

import type { GetContainerExecutionStateResponse } from "@/api/types.gen";
import { MINUTES } from "@/utils/constants";

import {
  addDaysAndFormat,
  elapsedMinutesCeil,
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

  it("uses relative time format when ended_at is missing (still running)", () => {
    const now = 1_700_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);

    const thirtyMinAgo = new Date(now - 30 * MINUTES).toISOString();

    const result = resolvePodLogsHydrationReplacements(
      { paddingMinutes: 5 },
      makeContainerState({ started_at: thirtyMinAgo, ended_at: null }),
      "pod-running",
    );

    expect(result.startTime).toBe("now-35m");
    expect(result.endTime).toBe("now");

    vi.restoreAllMocks();
  });

  it("caps endTime to 'now' when padded ended_at would be in the future", () => {
    const now = 1_700_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);

    const twoMinAgo = new Date(now - 2 * MINUTES).toISOString();

    const result = resolvePodLogsHydrationReplacements(
      { paddingMinutes: 5 },
      makeContainerState({ started_at: twoMinAgo, ended_at: twoMinAgo }),
      "pod-just-finished",
    );

    expect(result.endTime).toBe("now");

    vi.restoreAllMocks();
  });

  it("falls back to now-60m / now when started_at is missing", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = resolvePodLogsHydrationReplacements(
      { paddingMinutes: 5 },
      makeContainerState({ started_at: null }),
      "pod-unknown",
    );

    expect(result.startTime).toBe("now-60m");
    expect(result.endTime).toBe("now");
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("started_at is missing"),
    );

    warnSpy.mockRestore();
  });
});

describe("elapsedMinutesCeil", () => {
  it("rounds up partial minutes", () => {
    const ninetySecondsAgo = new Date(Date.now() - 90_000).toISOString();
    expect(elapsedMinutesCeil(ninetySecondsAgo)).toBe(2);
  });

  it("returns exact minutes for whole-minute offsets", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * MINUTES).toISOString();
    const result = elapsedMinutesCeil(fiveMinAgo);
    expect(result).toBeGreaterThanOrEqual(5);
    expect(result).toBeLessThanOrEqual(6);
  });

  it("returns 0 for a future timestamp", () => {
    const future = new Date(Date.now() + MINUTES).toISOString();
    expect(elapsedMinutesCeil(future)).toBe(0);
  });

  it("returns 1 for a timestamp just under 1 minute ago", () => {
    const thirtySecsAgo = new Date(Date.now() - 30_000).toISOString();
    expect(elapsedMinutesCeil(thirtySecsAgo)).toBe(1);
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
