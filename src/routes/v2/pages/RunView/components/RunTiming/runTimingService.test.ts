import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GetExecutionInfoResponse } from "@/api/types.gen";
import {
  fetchContainerExecutionState,
  fetchExecutionDetails,
} from "@/services/executionService";

import { fetchRunTimingData } from "./runTimingService";

vi.mock("@/services/executionService", () => ({
  fetchContainerExecutionState: vi.fn(),
  fetchExecutionDetails: vi.fn(),
}));

const leafComponent = {
  name: "Leaf component",
  implementation: { container: { image: "python:3.12" } },
};

const subgraphComponent = {
  name: "Nested pipeline",
  implementation: {
    graph: {
      tasks: {
        nested: { componentRef: { spec: leafComponent } },
      },
    },
  },
};

const rootDetails: GetExecutionInfoResponse = {
  id: "root-exec",
  child_task_execution_ids: {
    first: "exec-first",
    second: "exec-second",
    subgraph: "exec-subgraph",
  },
  task_spec: {
    componentRef: {
      spec: {
        name: "Example pipeline",
        implementation: {
          graph: {
            tasks: {
              first: { componentRef: { spec: leafComponent } },
              second: {
                componentRef: { spec: leafComponent },
                arguments: {
                  input: {
                    taskOutput: { taskId: "first", outputName: "result" },
                  },
                },
              },
              subgraph: { componentRef: { spec: subgraphComponent } },
            },
          },
        },
      },
    },
  },
};

function leafDetails(id: string): GetExecutionInfoResponse {
  return {
    id,
    child_task_execution_ids: {},
    input_artifacts:
      id === "exec-second" ? { input: { id: "artifact-first" } } : {},
    output_artifacts:
      id === "exec-first" ? { output: { id: "artifact-first" } } : {},
    task_spec: { componentRef: { spec: leafComponent } },
    status_history: [
      { status: "RUNNING", first_observed_at: "2026-07-14T10:00:00Z" },
      { status: "SUCCEEDED", first_observed_at: "2026-07-14T10:01:00Z" },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchExecutionDetails).mockImplementation(async (executionId) => {
    if (executionId === "root-exec") return rootDetails;
    if (executionId === "exec-subgraph") {
      return {
        id: executionId,
        child_task_execution_ids: { nested: "exec-nested" },
        task_spec: { componentRef: { spec: subgraphComponent } },
      };
    }
    return leafDetails(executionId);
  });
  vi.mocked(fetchContainerExecutionState).mockResolvedValue({
    status: "SUCCEEDED",
    started_at: "2026-07-14T10:00:00Z",
    ended_at: "2026-07-14T10:01:00Z",
  });
});

describe("fetchRunTimingData", () => {
  it("loads nested executions and preserves dependency and navigation context", async () => {
    const data = await fetchRunTimingData({
      rootDetails,
      backendUrl: "https://example.test",
      runCreatedAt: "2026-07-14T09:59:00Z",
      now: Date.parse("2026-07-14T10:02:00Z"),
    });

    expect(data.tasks.map((task) => task.executionId)).toEqual([
      "exec-first",
      "exec-second",
      "exec-subgraph",
      "exec-nested",
    ]);
    expect(
      data.tasks.find((task) => task.executionId === "exec-second"),
    ).toMatchObject({ dependencyExecutionIds: ["exec-first"] });
    expect(
      data.tasks.find((task) => task.executionId === "exec-nested"),
    ).toMatchObject({
      depth: 1,
      navigationPath: ["Example pipeline", "subgraph"],
      parentExecutionId: "exec-subgraph",
    });
    expect(fetchExecutionDetails).toHaveBeenCalledTimes(5);
    expect(fetchExecutionDetails).toHaveBeenCalledWith(
      "root-exec",
      "https://example.test",
      { signal: undefined },
    );
    expect(fetchContainerExecutionState).toHaveBeenCalledTimes(3);
    expect(data.truncated).toBe(false);
  });

  it("caps recursive requests for large runs", async () => {
    const child_task_execution_ids = Object.fromEntries(
      Array.from({ length: 251 }, (_, index) => [
        `task-${index}`,
        `exec-${index}`,
      ]),
    );

    vi.mocked(fetchExecutionDetails).mockResolvedValueOnce({
      ...rootDetails,
      child_task_execution_ids,
    });

    const data = await fetchRunTimingData({
      rootDetails: { ...rootDetails, child_task_execution_ids },
      backendUrl: "https://example.test",
      now: Date.parse("2026-07-14T10:02:00Z"),
    });

    expect(data.tasks).toHaveLength(250);
    expect(data.truncated).toBe(true);
    expect(fetchExecutionDetails).toHaveBeenCalledTimes(251);
  });
});
