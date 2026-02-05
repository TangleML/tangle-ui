import { renderHook } from "@testing-library/react";
import { MarkerType } from "@xyflow/react";
import { describe, expect, it } from "vitest";

import type { ComponentSpec } from "../utils/componentSpec";
import useComponentSpecToEdges from "./useComponentSpecToEdges";

describe("useComponentSpecToEdges", () => {
  const createBasicComponentSpec = (implementation: any): ComponentSpec => ({
    name: "Test Component",
    implementation,
    inputs: [],
    outputs: [],
  });

  it("returns empty array for non-graph implementations", () => {
    const componentSpec = createBasicComponentSpec({
      container: { image: "test" },
    });

    const { result } = renderHook(() => useComponentSpecToEdges(componentSpec));

    expect(result.current.edges).toEqual([]);
  });

  it("creates task edges correctly", () => {
    const componentSpec = createBasicComponentSpec({
      graph: {
        tasks: {
          task1: {
            componentRef: {},
            arguments: {
              input1: {
                taskOutput: { taskId: "task2", outputName: "output1" },
              },
            },
          },
        },
        outputValues: {},
      },
    });

    const { result } = renderHook(() => useComponentSpecToEdges(componentSpec));

    expect(result.current.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "task2_output1-task1_input1",
          source: "task_task2",
          sourceHandle: "output_output1",
          target: "task_task1",
          targetHandle: "input_input1",
          markerEnd: { type: MarkerType.Arrow },
          type: "customEdge",
        }),
      ]),
    );
  });

  it("creates graph input edges correctly", () => {
    const componentSpec = createBasicComponentSpec({
      graph: {
        tasks: {
          task1: {
            componentRef: {},
            arguments: {
              input1: { graphInput: { inputName: "graphInput1" } },
            },
          },
        },
        outputValues: {},
      },
    });

    const { result } = renderHook(() => useComponentSpecToEdges(componentSpec));

    expect(result.current.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "Input_graphInput1-task1_input1",
          source: "input_graphInput1",
          sourceHandle: null,
          target: "task_task1",
          targetHandle: "input_input1",
          markerEnd: { type: MarkerType.Arrow },
          type: "customEdge",
        }),
      ]),
    );
  });

  it("creates output edges correctly", () => {
    const componentSpec: ComponentSpec = {
      name: "Test Component",
      implementation: {
        graph: {
          tasks: {},
          outputValues: {
            graphOutput1: {
              taskOutput: { taskId: "task1", outputName: "output1" },
            },
          },
        },
      },
      inputs: [],
      outputs: [],
    };

    const { result } = renderHook(() => useComponentSpecToEdges(componentSpec));

    expect(result.current.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "task1_output1-Output_graphOutput1",
          source: "task_task1",
          sourceHandle: "output_output1",
          target: "output_graphOutput1",
          targetHandle: null,
          markerEnd: { type: MarkerType.Arrow },
          type: "customEdge",
        }),
      ]),
    );
  });

  it("handles string arguments by returning no edges", () => {
    const componentSpec: ComponentSpec = {
      name: "Test Component",
      implementation: {
        graph: {
          tasks: {
            task1: {
              componentRef: {},
              arguments: {
                input1: "string value",
              },
            },
          },
          outputValues: {},
        },
      },
      inputs: [],
      outputs: [],
    };

    const { result } = renderHook(() => useComponentSpecToEdges(componentSpec));
    expect(result.current.edges).toEqual([]);
  });

  it("handles complex component specs with multiple edge types", () => {
    const componentSpec: ComponentSpec = {
      name: "Test Component",
      implementation: {
        graph: {
          tasks: {
            task1: {
              componentRef: {},
              arguments: {
                input1: { graphInput: { inputName: "graphInput1" } },
                input2: "static value",
              },
            },
            task2: {
              componentRef: {},
              arguments: {
                input1: {
                  taskOutput: { taskId: "task1", outputName: "output1" },
                },
              },
            },
          },
          outputValues: {
            graphOutput1: {
              taskOutput: { taskId: "task2", outputName: "output1" },
            },
          },
        },
      },
      inputs: [],
      outputs: [],
    };

    const { result } = renderHook(() => useComponentSpecToEdges(componentSpec));

    expect(result.current.edges).toHaveLength(3);

    expect(result.current.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "Input_graphInput1-task1_input1",
          source: "input_graphInput1",
          sourceHandle: null,
          target: "task_task1",
          targetHandle: "input_input1",
          markerEnd: { type: MarkerType.Arrow },
          type: "customEdge",
        }),
      ]),
    );

    expect(result.current.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "task1_output1-task2_input1",
          source: "task_task1",
          sourceHandle: "output_output1",
          target: "task_task2",
          targetHandle: "input_input1",
          markerEnd: { type: MarkerType.Arrow },
          type: "customEdge",
        }),
      ]),
    );

    expect(result.current.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "task2_output1-Output_graphOutput1",
          source: "task_task2",
          sourceHandle: "output_output1",
          target: "output_graphOutput1",
          targetHandle: null,
          markerEnd: { type: MarkerType.Arrow },
          type: "customEdge",
        }),
      ]),
    );
  });
});
