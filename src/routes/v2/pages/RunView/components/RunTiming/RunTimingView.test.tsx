import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RunTimingData } from "./runTiming.types";
import { RunTimingView } from "./RunTimingView";

const mocks = vi.hoisted(() => ({
  editor: { selectNode: vi.fn() },
  navigation: {
    rootSpec: { name: "Pipeline" },
    navigateToPath: vi.fn(),
  },
  refetch: vi.fn(),
}));

const timingData: RunTimingData = {
  tasks: [
    {
      executionId: "exec-a",
      parentExecutionId: "root-exec",
      taskId: "task-a",
      taskName: "task-a",
      navigationPath: ["Pipeline"],
      depth: 0,
      dependencyExecutionIds: [],
      isSubgraph: false,
      status: "SUCCEEDED",
      phases: [
        {
          name: "runtime",
          startAt: 1_000,
          endAt: 2_000,
          durationMs: 1_000,
        },
      ],
      startAt: 1_000,
      endAt: 2_000,
      durationMs: 1_000,
      cacheState: "unknown",
      timingQuality: "partial",
    },
  ],
  truncated: false,
  rangeStart: 1_000,
  rangeEnd: 2_000,
  criticalPathExecutionIds: new Set(["exec-a"]),
  metrics: {
    wallClockDurationMs: 1_000,
    totalTaskCount: 1,
    cachedTaskCount: 0,
    startupCoverage: 0,
    busyRuntimeMs: 1_000,
    busyPercent: 100,
    criticalPathDurationMs: 1_000,
  },
};

vi.mock("@/providers/ExecutionDataProvider", () => ({
  useExecutionData: () => ({
    rootDetails: { id: "root-exec" },
    rootState: { child_execution_status_stats: {} },
    metadata: { created_at: "2026-07-14T10:00:00Z" },
  }),
}));

vi.mock("@/routes/v2/shared/store/SharedStoreContext", () => ({
  useSharedStores: () => ({
    editor: mocks.editor,
    navigation: mocks.navigation,
  }),
}));

vi.mock("./useRunTimingData", () => ({
  useRunTimingData: () => ({
    data: timingData,
    isFetching: false,
    isLoading: false,
    refetch: mocks.refetch,
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("RunTimingView", () => {
  it("navigates to a task's graph context before opening its properties", () => {
    mocks.navigation.navigateToPath.mockReturnValue({
      tasks: [{ $id: "model-task-a", name: "task-a" }],
    });

    render(<RunTimingView />);

    expect(screen.getByTestId("run-timing-view")).toHaveClass(
      "h-full",
      "min-h-0",
      "w-full",
      "min-w-0",
      "max-w-full",
      "overflow-hidden",
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Open task-a task details" }),
    );

    expect(mocks.navigation.navigateToPath).toHaveBeenCalledWith(["Pipeline"]);
    expect(mocks.editor.selectNode).toHaveBeenCalledWith(
      "model-task-a",
      "task",
      { entityId: "model-task-a" },
    );
  });
});
