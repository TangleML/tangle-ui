import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AggregatorOutputType } from "@/types/aggregator";

import type { TaskNodeViewProps } from "./TaskNode";
import { TaskNodeCard } from "./TaskNodeCard";
import { TaskNodeSimplified } from "./TaskNodeSimplified";

vi.mock("@/providers/ThemeProvider", () => ({
  useTheme: () => ({ resolvedTheme: "light" }),
}));

const buildProps = (
  overrides: Partial<TaskNodeViewProps> = {},
): TaskNodeViewProps => ({
  id: "node-task-1",
  entityId: "task-1",
  taskName: "Subgraph task",
  selected: false,
  isHovered: false,
  isSubgraph: true,
  collapsed: false,
  description: "",
  inputs: [],
  outputs: [],
  connectedInputNames: new Set(),
  connectedOutputNames: new Set(),
  annotations: [],
  cacheDisabled: false,
  inputDisplayValues: {},
  isAggregator: false,
  outputType: AggregatorOutputType.JsonArray,
  onOutputTypeChange: vi.fn(),
  onNodeClick: vi.fn(),
  onInputClick: vi.fn(),
  onOutputClick: vi.fn(),
  onHandleClick: vi.fn(),
  ...overrides,
});

afterEach(cleanup);

describe("TaskNodeCard", () => {
  it("shows child execution progress for a subgraph", () => {
    render(
      <TaskNodeCard
        {...buildProps({
          subgraphExecutionStats: { SUCCEEDED: 2, RUNNING: 1 },
        })}
      />,
    );

    expect(screen.getByLabelText("2 Succeeded")).toBeInTheDocument();
    expect(screen.getByLabelText("1 Running")).toBeInTheDocument();
  });

  it("shows child execution progress in the simplified subgraph card", () => {
    render(
      <TaskNodeSimplified
        {...buildProps({
          subgraphExecutionStats: { SUCCEEDED: 2, RUNNING: 1 },
        })}
      />,
    );

    expect(screen.getByLabelText("2 Succeeded")).toBeInTheDocument();
    expect(screen.getByLabelText("1 Running")).toBeInTheDocument();
  });

  it("does not show child execution progress for a container task", () => {
    render(
      <TaskNodeCard
        {...buildProps({
          isSubgraph: false,
          subgraphExecutionStats: { SUCCEEDED: 2, RUNNING: 1 },
        })}
      />,
    );

    expect(screen.queryByLabelText("2 Succeeded")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("1 Running")).not.toBeInTheDocument();
  });
});
