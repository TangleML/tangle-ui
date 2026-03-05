import { render, screen } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TaskNodeInputs } from "@/components/shared/ReactFlow/FlowCanvas/TaskNode/TaskNodeCard/TaskNodeInputs";
import { useTaskNode } from "@/providers/TaskNodeProvider";
import type { ArgumentType, InputSpec, TaskSpec } from "@/utils/componentSpec";

vi.mock("@/providers/ComponentLibraryProvider", () => ({
  useComponentLibrary: () => ({
    setSearchTerm: vi.fn(),
    setSearchFilters: vi.fn(),
    searchTerm: "",
    searchFilters: [],
    highlightSearchResults: false,
    setHighlightSearchResults: vi.fn(),
  }),
}));

vi.mock("@/providers/ComponentSpecProvider", () => ({
  useComponentSpec: () => ({
    graphSpec: {
      tasks: {},
    },
  }),
}));

vi.mock("@/providers/TaskNodeProvider");

const TestWrapper = ReactFlowProvider;

describe("<TaskNodeInputs />", () => {
  const mockUseTaskNode = vi.mocked(useTaskNode);

  const useMockedUseTaskNode = (inputs: InputSpec[], taskSpec: TaskSpec) => {
    mockUseTaskNode.mockReturnValue({
      inputs,
      taskSpec,
      state: { readOnly: false },
      nodeId: "test-node",
      callbacks: { onSelect: vi.fn() },
    } as any);
  };

  const createMockInput = (
    name: string,
    type: string = "String",
    optional: boolean = false,
    defaultValue?: string,
  ): InputSpec => ({
    name,
    type,
    optional,
    default: defaultValue,
  });

  const createMockTaskSpec = (
    taskArguments?: Record<string, ArgumentType>,
  ): TaskSpec => ({
    componentRef: { digest: "test-digest" },
    arguments: taskArguments,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("invalid arguments", () => {
    it("should render inputs and mark invalid ones correctly", () => {
      const inputs = [
        createMockInput("validInput", "String", false),
        createMockInput("invalidInput", "String", false),
        createMockInput("optionalInput", "String", true),
      ];
      const taskSpec = createMockTaskSpec({
        validInput: "some value",
        // invalidInput is missing, should be marked as invalid
        // optionalInput is optional, so it's valid even without value
      });

      useMockedUseTaskNode(inputs, taskSpec);

      render(<TaskNodeInputs collapsed={false} expanded={true} />, {
        wrapper: TestWrapper,
      });

      // Check that all inputs are rendered
      expect(screen.getByTestId("input-handle-validInput")).toBeInTheDocument();
      expect(
        screen.getByTestId("input-handle-invalidInput"),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("input-handle-optionalInput"),
      ).toBeInTheDocument();

      // Check invalid marking
      expect(screen.getByTestId("input-handle-validInput")).toHaveAttribute(
        "data-invalid",
        "false",
      );
      expect(screen.getByTestId("input-handle-invalidInput")).toHaveAttribute(
        "data-invalid",
        "true",
      );
      expect(screen.getByTestId("input-handle-optionalInput")).toHaveAttribute(
        "data-invalid",
        "false",
      );
    });

    it("should show hidden invalid arguments warning in collapsed mode", () => {
      const inputs = [
        createMockInput("visibleInput", "String", false),
        createMockInput("hiddenInvalidInput1", "String", false),
        createMockInput("hiddenInvalidInput2", "String", false),
      ];
      const taskSpec = createMockTaskSpec({
        visibleInput: {
          taskOutput: { taskId: "task1", outputName: "output1" },
        },
        // hiddenInvalidInput1 and hiddenInvalidInput2 are missing arguments
      });

      useMockedUseTaskNode(inputs, taskSpec);

      render(<TaskNodeInputs collapsed={true} expanded={false} />, {
        wrapper: TestWrapper,
      });

      // Should show warning about hidden invalid inputs
      expect(
        screen.getByText("2 hidden inputs have invalid arguments"),
      ).toBeInTheDocument();
    });

    it("should show singular form for single hidden invalid argument", () => {
      const inputs = [
        createMockInput("visibleInput", "String", false),
        createMockInput("hiddenInvalidInput", "String", false),
      ];
      const taskSpec = createMockTaskSpec({
        visibleInput: {
          taskOutput: { taskId: "task1", outputName: "output1" },
        },
        // hiddenInvalidInput is missing argument
      });

      useMockedUseTaskNode(inputs, taskSpec);

      render(<TaskNodeInputs collapsed={true} expanded={false} />, {
        wrapper: TestWrapper,
      });

      // Should show singular form
      expect(
        screen.getByText("1 hidden input has invalid arguments"),
      ).toBeInTheDocument();
    });

    it("should not show hidden invalid arguments warning when there are none", () => {
      const inputs = [
        createMockInput("visibleInput", "String", false),
        createMockInput("hiddenValidInput", "String", true), // optional
      ];
      const taskSpec = createMockTaskSpec({
        visibleInput: {
          taskOutput: { taskId: "task1", outputName: "output1" },
        },
      });

      useMockedUseTaskNode(inputs, taskSpec);

      render(<TaskNodeInputs collapsed={true} expanded={false} />, {
        wrapper: TestWrapper,
      });

      // Should not show warning
      expect(
        screen.queryByText(/hidden input.*invalid arguments/),
      ).not.toBeInTheDocument();
    });

    it("should handle edge case with no inputs", () => {
      useMockedUseTaskNode([], createMockTaskSpec());

      render(<TaskNodeInputs collapsed={false} expanded={true} />, {
        wrapper: TestWrapper,
      });

      // Component should not render anything when no inputs
      expect(screen.queryByTestId(/input-handle-/)).not.toBeInTheDocument();
    });

    it("should correctly identify and display all invalid argument scenarios", () => {
      const inputs = [
        createMockInput("required_no_arg", "String", false), // Invalid: required, no argument, no default
        createMockInput("required_with_arg", "String", false), // Valid: required, has argument
        createMockInput("required_with_default", "String", false, "default"), // Valid: required, has default
        createMockInput("optional_no_arg", "String", true), // Valid: optional
        createMockInput("optional_with_arg", "String", true), // Valid: optional with argument
        createMockInput("task_output_connected", "String", false), // Valid: connected to task output
      ];

      const taskSpec = createMockTaskSpec({
        required_with_arg: "some value",
        optional_with_arg: "optional value",
        task_output_connected: {
          taskOutput: { taskId: "upstream", outputName: "result" },
        },
        // required_no_arg is missing - should be invalid
        // required_with_default has default - should be valid
        // optional_no_arg is optional - should be valid
      });

      useMockedUseTaskNode(inputs, taskSpec);

      render(<TaskNodeInputs collapsed={false} expanded={true} />, {
        wrapper: TestWrapper,
      });

      // Check invalid markings
      expect(
        screen.getByTestId("input-handle-required_no_arg"),
      ).toHaveAttribute("data-invalid", "true");
      expect(
        screen.getByTestId("input-handle-required_with_arg"),
      ).toHaveAttribute("data-invalid", "false");
      expect(
        screen.getByTestId("input-handle-required_with_default"),
      ).toHaveAttribute("data-invalid", "false");
      expect(
        screen.getByTestId("input-handle-optional_no_arg"),
      ).toHaveAttribute("data-invalid", "false");
      expect(
        screen.getByTestId("input-handle-optional_with_arg"),
      ).toHaveAttribute("data-invalid", "false");
      expect(
        screen.getByTestId("input-handle-task_output_connected"),
      ).toHaveAttribute("data-invalid", "false");
    });
  });
});
