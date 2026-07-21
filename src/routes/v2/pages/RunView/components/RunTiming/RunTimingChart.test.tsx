import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RunTimingData, RunTimingTask } from "./runTiming.types";
import { RunTimingChart } from "./RunTimingChart";

const START = Date.parse("2026-07-14T10:00:00Z");
const MINUTE = 60_000;

function task(overrides: Partial<RunTimingTask> = {}): RunTimingTask {
  return {
    executionId: "exec-a",
    parentExecutionId: "root",
    taskId: "prepare-data",
    taskName: "prepare-data",
    navigationPath: ["Pipeline"],
    depth: 0,
    dependencyExecutionIds: [],
    isSubgraph: false,
    status: "SUCCEEDED",
    phases: [
      {
        name: "startup",
        startAt: START,
        endAt: START + MINUTE,
        durationMs: MINUTE,
      },
      {
        name: "runtime",
        startAt: START + MINUTE,
        endAt: START + 3 * MINUTE,
        durationMs: 2 * MINUTE,
      },
    ],
    startAt: START,
    endAt: START + 3 * MINUTE,
    durationMs: 3 * MINUTE,
    cacheState: "unknown",
    timingQuality: "partial",
    ...overrides,
  };
}

function timingData(tasks: RunTimingTask[]): RunTimingData {
  return {
    tasks,
    truncated: false,
    rangeStart: START,
    rangeEnd: START + 3 * MINUTE,
    criticalPathExecutionIds: new Set(["exec-a"]),
    metrics: {
      wallClockDurationMs: 3 * MINUTE,
      totalTaskCount: tasks.length,
      cachedTaskCount: 0,
      startupCoverage: 1,
      busyRuntimeMs: 2 * MINUTE,
      busyPercent: 67,
      criticalPathDurationMs: 3 * MINUTE,
    },
  };
}

afterEach(cleanup);

describe("RunTimingChart", () => {
  it("renders phase and critical-path information accessibly", () => {
    const onTaskSelect = vi.fn();
    const timingTask = task();
    render(
      <RunTimingChart
        data={timingData([timingTask])}
        onTaskSelect={onTaskSelect}
      />,
    );

    expect(screen.getByRole("table", { name: "Run timing" })).toHaveClass(
      "min-w-0",
      "w-full",
      "max-w-full",
      "overflow-auto",
    );
    expect(screen.getAllByRole("row")[0]).toHaveStyle({
      gridTemplateColumns: "320px minmax(1200px, 1fr)",
      minWidth: "1520px",
    });
    expect(screen.getAllByText("3m 0s")[0].parentElement).toHaveStyle({
      right: "12px",
    });
    expect(screen.getByText("prepare-data")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "startup / queue 1m 0s" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "runtime 2m 0s" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Critical path task/)).toBeInTheDocument();
    expect(screen.getByText(/Status: Succeeded/)).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Open prepare-data task details" }),
    );
    expect(onTaskSelect).toHaveBeenCalledWith(timingTask);
  });

  it("resizes the task name column with mouse and keyboard controls", () => {
    render(
      <RunTimingChart data={timingData([task()])} onTaskSelect={vi.fn()} />,
    );

    const resizeHandle = screen.getByRole("separator", {
      name: "Resize task name column",
    });
    fireEvent.keyDown(resizeHandle, { key: "ArrowRight" });

    expect(resizeHandle).toHaveAttribute("aria-valuenow", "336");
    expect(screen.getAllByRole("row")[0]).toHaveStyle({
      gridTemplateColumns: "336px minmax(1200px, 1fr)",
      minWidth: "1536px",
    });

    fireEvent.mouseDown(resizeHandle, { clientX: 100 });
    fireEvent.mouseMove(document, { clientX: 164 });
    fireEvent.mouseUp(document);

    expect(resizeHandle).toHaveAttribute("aria-valuenow", "400");
  });

  it("identifies cache hits without showing historical runtime", () => {
    render(
      <RunTimingChart
        data={timingData([
          task({
            cacheState: "hit",
            phases: [],
            startAt: START,
            endAt: START,
            durationMs: 0,
          }),
        ])}
        onTaskSelect={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("img", {
        name: "Cache hit; no container runtime in this run",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Cache hit\./)).toBeInTheDocument();
  });

  it("shows an empty state before task executions exist", () => {
    render(<RunTimingChart data={timingData([])} onTaskSelect={vi.fn()} />);

    expect(
      screen.getByText("This run has no task executions yet."),
    ).toBeInTheDocument();
  });

  it("filters task rows by task or component name", () => {
    render(
      <RunTimingChart
        data={timingData([task({ componentName: "Python component" })])}
        taskFilter="missing"
        onTaskSelect={vi.fn()}
      />,
    );

    expect(
      screen.getByText("No tasks match the current filters."),
    ).toBeInTheDocument();
  });
});
