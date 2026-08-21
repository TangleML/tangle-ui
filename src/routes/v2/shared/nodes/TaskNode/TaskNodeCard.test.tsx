import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  isConditional: false,
  conditionDisplayValue: "Always",
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

  describe("collapsed inputs section", () => {
    const renderCollapsed = (overrides: Partial<TaskNodeViewProps> = {}) => {
      const props = buildProps({
        isSubgraph: false,
        collapsed: true,
        inputs: [{ name: "name", type: "String" }, { name: "greeting" }],
        onHandleClick: vi.fn((_handleId, event) => event.stopPropagation()),
        ...overrides,
      });

      render(
        <ReactFlowProvider>
          <TaskNodeCard {...props} />
        </ReactFlowProvider>,
      );

      return props;
    };

    it("opens the task properties for an input when its label is clicked", async () => {
      const props = renderCollapsed();

      await userEvent.click(screen.getByTestId("input-label-name"));

      expect(props.onInputClick).toHaveBeenCalledWith(
        "name",
        expect.anything(),
      );
      expect(screen.getByText(/\+1 more input/)).toBeInTheDocument();
    });

    it("opens the task properties for an input when its label is activated by keyboard", async () => {
      const props = renderCollapsed();

      screen.getByTestId("input-label-name").focus();
      await userEvent.keyboard("{Enter}");
      await userEvent.keyboard(" ");

      expect(props.onInputClick).toHaveBeenCalledTimes(2);
      expect(props.onInputClick).toHaveBeenCalledWith(
        "name",
        expect.anything(),
      );
      expect(screen.getByText(/\+1 more input/)).toBeInTheDocument();
    });

    it("selects the connected edges when an input handle is clicked", async () => {
      const props = renderCollapsed();

      await userEvent.click(screen.getByTestId("input-handle-name"));

      expect(props.onHandleClick).toHaveBeenCalledWith(
        "input_name",
        expect.anything(),
      );
      expect(props.onInputClick).not.toHaveBeenCalled();
      expect(screen.getByText(/\+1 more input/)).toBeInTheDocument();
    });

    it("expands the hidden inputs when the rest of the row is clicked", async () => {
      const props = renderCollapsed();

      await userEvent.click(screen.getByText(/\+1 more input/));

      expect(props.onInputClick).not.toHaveBeenCalled();
      expect(screen.getByTestId("input-label-greeting")).toBeInTheDocument();
      expect(screen.getByText("(Click to collapse)")).toBeInTheDocument();
    });

    it("selects the connected edges when an input handle is clicked on an expanded node", async () => {
      const props = renderCollapsed({ collapsed: false });

      await userEvent.click(screen.getByTestId("input-handle-name"));

      expect(props.onHandleClick).toHaveBeenCalledWith(
        "input_name",
        expect.anything(),
      );
      expect(props.onInputClick).not.toHaveBeenCalled();
    });
  });

  describe("run condition", () => {
    const renderConditional = (overrides: Partial<TaskNodeViewProps> = {}) => {
      const props = buildProps({
        isSubgraph: false,
        inputs: [{ name: "name", type: "String" }],
        isConditional: true,
        onHandleClick: vi.fn((_handleId, event) => event.stopPropagation()),
        ...overrides,
      });

      render(
        <ReactFlowProvider>
          <TaskNodeCard {...props} />
        </ReactFlowProvider>,
      );

      return props;
    };

    it("is hidden for a task that is not conditional", () => {
      renderConditional({ isConditional: false });

      expect(screen.queryByText("Run when")).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("run-condition-handle"),
      ).not.toBeInTheDocument();
    });

    it("shows the literal for a task with no connected condition", () => {
      renderConditional({ conditionDisplayValue: "Never" });

      expect(screen.getByText("Run when")).toBeInTheDocument();
      expect(screen.getByText("Never")).toBeInTheDocument();
    });

    it("shows the upstream reference when the condition is connected", () => {
      renderConditional({ conditionDisplayValue: "→ Flag.flag" });

      expect(screen.getByText("→ Flag.flag")).toBeInTheDocument();
    });

    it("stays out of the collapsed inputs count", () => {
      renderConditional({
        collapsed: true,
        inputs: [{ name: "name" }, { name: "greeting" }, { name: "locale" }],
      });

      expect(screen.getByText("+2 more inputs")).toBeInTheDocument();
      expect(screen.getByText("Run when")).toBeInTheDocument();
    });

    it("stays visible when the collapsed inputs are expanded", async () => {
      renderConditional({
        collapsed: true,
        inputs: [{ name: "name" }, { name: "greeting" }, { name: "locale" }],
      });

      await userEvent.click(screen.getByText("+2 more inputs"));

      expect(screen.getByTestId("input-label-locale")).toBeInTheDocument();
      expect(screen.getByText("Run when")).toBeInTheDocument();
    });

    it("selects the connected edges when its handle is clicked", async () => {
      const props = renderConditional();

      await userEvent.click(screen.getByTestId("run-condition-handle"));

      expect(props.onHandleClick).toHaveBeenCalledWith(
        "input___is_enabled__",
        expect.anything(),
      );
    });
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
