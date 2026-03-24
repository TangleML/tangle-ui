import { describe, expect, it } from "vitest";

import type { GetContainerExecutionStateResponse } from "@/api/types.gen";

import {
  extractJobName,
  extractPodName,
  resolveJobEventsHydrationReplacements,
} from "./logsEventsResolvers";

describe("extractPodName", () => {
  it("returns null for undefined container state", () => {
    expect(extractPodName(undefined)).toBeNull();
  });

  it("returns null when debug_info is missing", () => {
    const state: GetContainerExecutionStateResponse = { status: "SUCCEEDED" };
    expect(extractPodName(state)).toBeNull();
  });

  it("extracts pod_name from debug_info top level", () => {
    const state: GetContainerExecutionStateResponse = {
      status: "SUCCEEDED",
      debug_info: { pod_name: "worker-abc-123" },
    };
    expect(extractPodName(state)).toBe("worker-abc-123");
  });

  it("extracts pod_name from debug_info.kubernetes", () => {
    const state: GetContainerExecutionStateResponse = {
      status: "SUCCEEDED",
      debug_info: { kubernetes: { pod_name: "worker-xyz-456" } },
    };
    expect(extractPodName(state)).toBe("worker-xyz-456");
  });

  it("returns null for job-only responses (no pod_name anywhere)", () => {
    const state: GetContainerExecutionStateResponse = {
      status: "SUCCEEDED",
      debug_info: {
        kubernetes_job: { job_name: "tangle-ce-019d1c5fa8836e423671" },
      },
    };
    expect(extractPodName(state)).toBeNull();
  });
});

describe("extractJobName", () => {
  it("returns null for undefined container state", () => {
    expect(extractJobName(undefined)).toBeNull();
  });

  it("returns null when debug_info is missing", () => {
    const state: GetContainerExecutionStateResponse = { status: "SUCCEEDED" };
    expect(extractJobName(state)).toBeNull();
  });

  it("returns null for pod-only responses", () => {
    const state: GetContainerExecutionStateResponse = {
      status: "SUCCEEDED",
      debug_info: { pod_name: "worker-abc-123" },
    };
    expect(extractJobName(state)).toBeNull();
  });

  it("extracts job_name from debug_info.kubernetes_job", () => {
    const state: GetContainerExecutionStateResponse = {
      status: "SUCCEEDED",
      debug_info: {
        kubernetes_job: { job_name: "tangle-ce-019d1c5fa8836e423671" },
      },
    };
    expect(extractJobName(state)).toBe("tangle-ce-019d1c5fa8836e423671");
  });

  it("returns null when kubernetes_job exists but job_name is missing", () => {
    const state: GetContainerExecutionStateResponse = {
      status: "SUCCEEDED",
      debug_info: { kubernetes_job: { some_other_key: "value" } },
    };
    expect(extractJobName(state)).toBeNull();
  });
});

describe("resolveJobEventsHydrationReplacements", () => {
  const metadata = { paddingMinutes: 5 };
  const jobName = "tangle-ce-019d1c5fa8836e423671";

  it("returns absolute padded timestamps for a completed job", () => {
    const state: GetContainerExecutionStateResponse = {
      status: "SUCCEEDED",
      started_at: "2026-03-24T01:17:00.000Z",
      ended_at: "2026-03-24T03:18:13.000Z",
    };

    const result = resolveJobEventsHydrationReplacements(
      metadata,
      state,
      jobName,
    );

    expect(result.jobName).toBe(jobName);
    expect(result.startTime).toBe("2026-03-24T01:12:00.000Z");
    expect(result.endTime).toBe("2026-03-24T03:23:13.000Z");
  });

  it("returns relative time when job is still running", () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const state: GetContainerExecutionStateResponse = {
      status: "RUNNING",
      started_at: fiveMinutesAgo,
    };

    const result = resolveJobEventsHydrationReplacements(
      metadata,
      state,
      jobName,
    );

    expect(result.jobName).toBe(jobName);
    expect(result.startTime).toMatch(/^now-\d+m$/);
    expect(result.endTime).toBe("now");
  });

  it("returns fallback relative time when started_at is missing", () => {
    const state: GetContainerExecutionStateResponse = {
      status: "SUCCEEDED",
    };

    const result = resolveJobEventsHydrationReplacements(
      metadata,
      state,
      jobName,
    );

    expect(result.jobName).toBe(jobName);
    expect(result.startTime).toBe("now-60m");
    expect(result.endTime).toBe("now");
  });
});
