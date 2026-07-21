import { describe, expect, it } from "vitest";

import type {
  GetContainerExecutionStateResponse,
  GetExecutionInfoResponse,
} from "@/api/types.gen";

import { formatTimingDuration, normalizeRunTimingData } from "./runTiming";
import type { RunTimingTaskSource } from "./runTiming.types";

const MINUTE = 60_000;
const RUN_START = Date.parse("2026-07-14T10:00:00.000Z");

function details({
  id,
  inputArtifactIds = [],
  outputArtifactIds = [],
}: {
  id: string;
  inputArtifactIds?: string[];
  outputArtifactIds?: string[];
}): GetExecutionInfoResponse {
  return {
    id,
    child_task_execution_ids: {},
    input_artifacts: Object.fromEntries(
      inputArtifactIds.map((artifactId, index) => [
        `input-${index}`,
        { id: artifactId },
      ]),
    ),
    output_artifacts: Object.fromEntries(
      outputArtifactIds.map((artifactId, index) => [
        `output-${index}`,
        { id: artifactId },
      ]),
    ),
    task_spec: {
      componentRef: {
        name: "Python component",
        digest: "sha256:abc",
        spec: {
          name: "Python component",
          implementation: { container: { image: "python:3.12" } },
        },
      },
    },
  };
}

function containerState(
  startMinutes: number,
  endMinutes: number | undefined,
  status: GetContainerExecutionStateResponse["status"] = "SUCCEEDED",
): GetContainerExecutionStateResponse {
  return {
    status,
    started_at: new Date(RUN_START + startMinutes * MINUTE).toISOString(),
    ended_at:
      endMinutes === undefined
        ? undefined
        : new Date(RUN_START + endMinutes * MINUTE).toISOString(),
  };
}

function source({
  executionId,
  parentExecutionId = "root",
  depth = 0,
  isSubgraph = false,
  inputArtifactIds = [],
  outputArtifactIds = [],
  state,
}: {
  executionId: string;
  parentExecutionId?: string;
  depth?: number;
  isSubgraph?: boolean;
  inputArtifactIds?: string[];
  outputArtifactIds?: string[];
  state?: GetContainerExecutionStateResponse;
}): RunTimingTaskSource {
  return {
    executionId,
    parentExecutionId,
    taskId: executionId,
    navigationPath: depth === 0 ? ["Pipeline"] : ["Pipeline", "subgraph"],
    depth,
    inputArtifactIds,
    outputArtifactIds,
    details: details({ id: executionId, inputArtifactIds, outputArtifactIds }),
    containerState: state,
    isSubgraph,
  };
}

describe("normalizeRunTimingData", () => {
  it("reconstructs dependencies and startup gaps from artifact readiness", () => {
    const data = normalizeRunTimingData(
      [
        source({
          executionId: "prepare",
          outputArtifactIds: ["artifact-a"],
          state: containerState(1, 3),
        }),
        source({
          executionId: "train",
          inputArtifactIds: ["artifact-a"],
          state: containerState(4, 6),
        }),
      ],
      new Date(RUN_START).toISOString(),
      RUN_START + 10 * MINUTE,
    );

    expect(data.tasks[0].phases).toEqual([
      {
        name: "startup",
        startAt: RUN_START,
        endAt: RUN_START + MINUTE,
        durationMs: MINUTE,
      },
      {
        name: "runtime",
        startAt: RUN_START + MINUTE,
        endAt: RUN_START + 3 * MINUTE,
        durationMs: 2 * MINUTE,
      },
    ]);
    expect(data.tasks[1]).toMatchObject({
      dependencyExecutionIds: ["prepare"],
      readyAt: RUN_START + 3 * MINUTE,
      phases: [
        {
          name: "startup",
          startAt: RUN_START + 3 * MINUTE,
          endAt: RUN_START + 4 * MINUTE,
          durationMs: MINUTE,
        },
        {
          name: "runtime",
          startAt: RUN_START + 4 * MINUTE,
          endAt: RUN_START + 6 * MINUTE,
          durationMs: 2 * MINUTE,
        },
      ],
    });
    expect(data.rangeEnd).toBe(RUN_START + 6 * MINUTE);
    expect(data.metrics).toMatchObject({
      wallClockDurationMs: 6 * MINUTE,
      totalTaskCount: 2,
      cachedTaskCount: 0,
      averageStartupMs: MINUTE,
      busyRuntimeMs: 4 * MINUTE,
      busyPercent: 67,
      criticalPathDurationMs: 6 * MINUTE,
    });
    expect(data.criticalPathExecutionIds).toEqual(
      new Set(["prepare", "train"]),
    );
  });

  it("uses the union of overlapping runtime intervals for compute time", () => {
    const data = normalizeRunTimingData(
      [
        source({ executionId: "a", state: containerState(1, 5) }),
        source({ executionId: "b", state: containerState(3, 7) }),
      ],
      new Date(RUN_START).toISOString(),
      RUN_START + 10 * MINUTE,
    );

    expect(data.metrics.busyRuntimeMs).toBe(6 * MINUTE);
    expect(data.metrics.busyPercent).toBe(86);
  });

  it("propagates completion through cached artifact dependencies", () => {
    const data = normalizeRunTimingData(
      [
        source({
          executionId: "fresh-upstream",
          outputArtifactIds: ["fresh-output"],
          state: containerState(1, 2),
        }),
        source({
          executionId: "cached-middle",
          inputArtifactIds: ["fresh-output"],
          outputArtifactIds: ["cached-output"],
          state: containerState(-10, -9),
        }),
        source({
          executionId: "fresh-downstream",
          inputArtifactIds: ["cached-output"],
          state: containerState(3, 4),
        }),
      ],
      new Date(RUN_START).toISOString(),
      RUN_START + 10 * MINUTE,
    );

    expect(data.tasks[1]).toMatchObject({
      cacheState: "hit",
      durationMs: 0,
      historicalRuntimeMs: MINUTE,
      phases: [],
    });
    expect(data.tasks[2]).toMatchObject({
      dependencyExecutionIds: ["cached-middle"],
      readyAt: RUN_START + 2 * MINUTE,
    });
    expect(data.metrics.cachedTaskCount).toBe(1);
    expect(data.criticalPathExecutionIds).toEqual(
      new Set(["fresh-upstream", "cached-middle", "fresh-downstream"]),
    );
  });

  it("resolves a subgraph output dependency to its latest-ending leaf", () => {
    const data = normalizeRunTimingData(
      [
        source({
          executionId: "subgraph",
          isSubgraph: true,
          outputArtifactIds: ["subgraph-output"],
        }),
        source({
          executionId: "child-a",
          parentExecutionId: "subgraph",
          depth: 1,
          state: containerState(1, 2),
        }),
        source({
          executionId: "child-b",
          parentExecutionId: "subgraph",
          depth: 1,
          state: containerState(1, 4),
        }),
        source({
          executionId: "downstream",
          inputArtifactIds: ["subgraph-output"],
          state: containerState(5, 6),
        }),
      ],
      new Date(RUN_START).toISOString(),
      RUN_START + 10 * MINUTE,
    );

    expect(data.tasks[0]).toMatchObject({
      isSubgraph: true,
      startAt: RUN_START,
      endAt: RUN_START + 4 * MINUTE,
    });
    expect(data.tasks[3]).toMatchObject({
      dependencyExecutionIds: ["child-b"],
      readyAt: RUN_START + 4 * MINUTE,
    });
  });

  it("keeps never-started leaves visible with unavailable timing", () => {
    const data = normalizeRunTimingData(
      [source({ executionId: "pending" })],
      new Date(RUN_START).toISOString(),
      RUN_START + MINUTE,
    );

    expect(data.tasks[0]).toMatchObject({
      phases: [],
      timingQuality: "unavailable",
      cacheState: "unknown",
    });
  });
});

describe("formatTimingDuration", () => {
  it("formats millisecond durations for timing labels", () => {
    expect(formatTimingDuration(3_725_000)).toBe("1h 2m 5s");
    expect(formatTimingDuration(undefined)).toBe("—");
  });
});
