import { cleanup, render, screen } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Task } from "@/models/componentSpec";
import { AggregatorOutputType } from "@/types/aggregator";

import { resolveInputDisplayData, type TaskNodeViewProps } from "./TaskNode";
import { TaskNodeCard } from "./TaskNodeCard";
import { TaskNodeSimplified } from "./TaskNodeSimplified";

vi.mock("@/providers/ThemeProvider", () => ({
  useTheme: () => ({ resolvedTheme: "light" }),
}));

vi.mock("@/routes/v2/shared/providers/SpecContext", () => ({
  useSpec: () => null,
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
  secretInputNames: new Set(),
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
  it("resolves secret argument references for display", () => {
    const task = new Task({
      $id: "task-1",
      name: "Generate response",
      componentRef: {},
      arguments: [
        {
          name: "api_key",
          value: { dynamicData: { secret: { name: "OPENAI_API_KEY" } } },
        },
        { name: "prompt", value: "Write a haiku" },
      ],
    });

    const displayData = resolveInputDisplayData(task, task.$id, null);

    expect(displayData.values).toEqual({
      api_key: "OPENAI_API_KEY",
      prompt: "Write a haiku",
    });
    expect(displayData.secretInputNames).toEqual(new Set(["api_key"]));
  });

  it("marks secret input references and leaves ordinary inputs unmarked", () => {
    render(
      <ReactFlowProvider>
        <TaskNodeCard
          {...buildProps({
            isSubgraph: false,
            inputs: [{ name: "api_key" }, { name: "prompt" }],
            inputDisplayValues: {
              api_key: "OPENAI_API_KEY",
              prompt: "Write a haiku",
            },
            secretInputNames: new Set(["api_key"]),
          })}
        />
      </ReactFlowProvider>,
    );

    expect(screen.getByTestId("input-secret-icon-api_key")).toBeInTheDocument();
    expect(
      screen.queryByTestId("input-secret-icon-prompt"),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/OPENAI_API_KEY/)).toHaveClass("text-amber-600");
    expect(screen.getByText(/OPENAI_API_KEY/)).toHaveTextContent(
      "Secret: OPENAI_API_KEY",
    );
  });

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
