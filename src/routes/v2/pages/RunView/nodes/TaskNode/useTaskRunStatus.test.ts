import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useExecutionDataOptionalMock, useSpecMock } = vi.hoisted(() => ({
  useExecutionDataOptionalMock: vi.fn(),
  useSpecMock: vi.fn(),
}));

vi.mock(
  "@/components/shared/ReactFlow/FlowCanvas/TaskNode/TaskOverview/logs",
  () => ({
    shouldStatusHaveLogs: (status: string | undefined) => status === "RUNNING",
  }),
);

vi.mock("@/providers/ExecutionDataProvider", () => ({
  useExecutionDataOptional: useExecutionDataOptionalMock,
}));

vi.mock("@/routes/v2/shared/providers/SpecContext", () => ({
  useSpec: useSpecMock,
}));

import { useTaskRunStatus } from "./useTaskRunStatus";

const executionData = {
  taskExecutionStatusMap: new Map([["subgraph-task", "RUNNING"]]),
  details: {
    child_task_execution_ids: {
      "subgraph-task": "subgraph-execution-1",
    },
  },
  state: {
    child_execution_status_stats: {
      "subgraph-execution-1": {
        SUCCEEDED: 2,
        RUNNING: 1,
      },
    },
  },
};

describe("useTaskRunStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useExecutionDataOptionalMock.mockReturnValue(executionData);
  });

  it("returns child execution progress for a subgraph task", () => {
    useSpecMock.mockReturnValue({
      tasks: [
        {
          $id: "task-1",
          name: "subgraph-task",
          subgraphSpec: {},
        },
      ],
    });

    const { result } = renderHook(() => useTaskRunStatus("task-1"));

    expect(result.current.subgraphExecutionStats).toEqual({
      SUCCEEDED: 2,
      RUNNING: 1,
    });
  });

  it("does not return child progress for a container task", () => {
    useSpecMock.mockReturnValue({
      tasks: [
        {
          $id: "task-1",
          name: "subgraph-task",
          subgraphSpec: undefined,
        },
      ],
    });

    const { result } = renderHook(() => useTaskRunStatus("task-1"));

    expect(result.current.subgraphExecutionStats).toBeNull();
  });
});
