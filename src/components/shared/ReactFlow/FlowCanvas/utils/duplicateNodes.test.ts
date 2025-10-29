import type { Node } from "@xyflow/react";
import { describe, expect, it, vi } from "vitest";

import type { NodeCallbacks, TaskNodeData } from "@/types/taskNode";
import type {
  ComponentSpec,
  InputSpec,
  OutputSpec,
  TaskOutputArgument,
  TaskSpec,
} from "@/utils/componentSpec";
import {
  inputNameToNodeId,
  outputNameToNodeId,
  taskIdToNodeId,
} from "@/utils/nodes/nodeIdUtils";

import { duplicateNodes } from "./duplicateNodes";

// Mock utility functions
const mockTaskSpec: TaskSpec = {
  componentRef: { name: "test-component" },
  arguments: {},
  annotations: {},
};

const mockInputSpec: InputSpec = {
  name: "test-input",
  type: "String",
  annotations: {},
};

const mockOutputSpec: OutputSpec = {
  name: "test-output",
  type: "String",
  annotations: {},
};

const createMockComponentSpec = (
  tasks: Record<string, TaskSpec> = {},
  inputs: InputSpec[] = [],
): ComponentSpec => ({
  name: "test-component",
  inputs,
  implementation: {
    graph: {
      tasks,
    },
  },
});

const createMockComponentSpecWithOutputs = (
  tasks: Record<string, TaskSpec> = {},
  inputs: InputSpec[] = [],
  outputs: OutputSpec[] = [],
): ComponentSpec => ({
  name: "test-component",
  inputs,
  outputs,
  implementation: {
    graph: {
      tasks,
      outputValues: outputs.reduce<Record<string, TaskOutputArgument>>(
        (acc, output) => {
          acc[output.name] = {
            taskOutput: {
              taskId: "task1",
              outputName: "result",
            },
          };
          return acc;
        },
        {},
      ),
    },
  },
});

// Create mock callbacks that match the expected shape
const createMockTaskNodeCallbacks = () => ({
  setArguments: vi.fn(),
  setAnnotations: vi.fn(),
  setCacheStaleness: vi.fn(),
  onDelete: vi.fn(),
  onDuplicate: vi.fn(),
  onUpgrade: vi.fn(),
});

const createMockNodeCallbacks = (): NodeCallbacks => ({
  setArguments: vi.fn(),
  setAnnotations: vi.fn(),
  setCacheStaleness: vi.fn(),
  onDelete: vi.fn(),
  onDuplicate: vi.fn(),
  onUpgrade: vi.fn(),
});

const createMockTaskNode = (
  taskId: string,
  taskSpec: TaskSpec,
  position = { x: 100, y: 100 },
): Node<TaskNodeData> => ({
  id: taskIdToNodeId(taskId),
  type: "task",
  position,
  data: {
    taskSpec,
    taskId,
    label: "Test Task",
    highlighted: false,
    callbacks: createMockTaskNodeCallbacks(),
    nodeCallbacks: createMockNodeCallbacks(),
  },
  selected: false,
  dragging: false,
  measured: { width: 200, height: 100 },
});

const createMockInputNode = (
  inputName: string,
  position = { x: 50, y: 50 },
): Node => ({
  id: inputNameToNodeId(inputName),
  type: "input",
  position,
  data: {
    label: inputName,
    inputSpec: { ...mockInputSpec, name: inputName },
  },
  selected: false,
  dragging: false,
  measured: { width: 150, height: 80 },
});

const createMockOutputNode = (
  outputName: string,
  position = { x: 300, y: 300 },
): Node => ({
  id: outputNameToNodeId(outputName),
  type: "output",
  position,
  data: {
    label: outputName,
    outputSpec: { ...mockOutputSpec, name: outputName },
  },
  selected: false,
  dragging: false,
  measured: { width: 150, height: 80 },
});

describe("duplicateNodes", () => {
  describe("error handling", () => {
    it("should throw error when componentSpec does not have graph implementation", () => {
      const componentSpec: ComponentSpec = {
        name: "test",
        implementation: {
          container: {
            image: "test-image",
          },
        },
      };

      const nodes: Node[] = [];

      expect(() => duplicateNodes(componentSpec, nodes)).toThrow(
        "ComponentSpec does not contain a graph implementation.",
      );
    });
  });

  describe("basic duplication", () => {
    it("should duplicate a single task node with default config", () => {
      const originalTaskSpec = {
        ...mockTaskSpec,
        annotations: {
          "editor.position": JSON.stringify({ x: 100, y: 100 }),
        },
      };

      const componentSpec = createMockComponentSpec({
        "original-task": originalTaskSpec,
      });

      const taskNode = createMockTaskNode("original-task", originalTaskSpec, {
        x: 100,
        y: 100,
      });

      const result = duplicateNodes(componentSpec, [taskNode]);

      expect(result.newNodes).toHaveLength(1);
      expect(result.newNodes[0].type).toBe("task");
      expect(result.newNodes[0].id).toBe(taskIdToNodeId("original-task 2"));
      expect(result.newNodes[0].position).toEqual({ x: 110, y: 110 });
      expect(result.newNodes[0].selected).toBe(true);

      // Check that the new task spec is created
      expect(result.updatedComponentSpec.implementation).toBeDefined();
      if ("graph" in result.updatedComponentSpec.implementation!) {
        expect(
          result.updatedComponentSpec.implementation.graph.tasks,
        ).toHaveProperty("original-task 2");
      }
    });

    it("should duplicate a single input node", () => {
      const inputSpec = {
        ...mockInputSpec,
        name: "original-input",
        annotations: {
          "editor.position": JSON.stringify({ x: 50, y: 50 }),
        },
      };

      const componentSpec = createMockComponentSpec({}, [inputSpec]);

      const inputNode = createMockInputNode("original-input", { x: 50, y: 50 });

      const result = duplicateNodes(componentSpec, [inputNode]);

      expect(result.newNodes).toHaveLength(1);
      expect(result.newNodes[0].type).toBe("input");
      expect(result.newNodes[0].id).toBe(inputNameToNodeId("original-input 2"));
      expect(result.newNodes[0].position).toEqual({ x: 60, y: 60 });

      expect(result.updatedComponentSpec.inputs).toHaveLength(2);
      expect(
        result.updatedComponentSpec.inputs?.some(
          (input) => input.name === "original-input 2",
        ),
      ).toBe(true);
    });

    it("should duplicate a single output node", () => {
      const outputSpec = {
        ...mockOutputSpec,
        name: "original-output",
        annotations: {
          "editor.position": JSON.stringify({ x: 300, y: 300 }),
        },
      };

      const componentSpec = createMockComponentSpecWithOutputs(
        {},
        [],
        [outputSpec],
      );

      const outputNode = createMockOutputNode("original-output", {
        x: 300,
        y: 300,
      });

      const result = duplicateNodes(componentSpec, [outputNode]);

      expect(result.newNodes).toHaveLength(1);
      expect(result.newNodes[0].type).toBe("output");
      expect(result.newNodes[0].id).toBe(
        outputNameToNodeId("original-output 2"),
      );
      expect(result.newNodes[0].position).toEqual({ x: 310, y: 310 });

      expect(result.updatedComponentSpec.outputs).toHaveLength(2);
      expect(
        result.updatedComponentSpec.outputs?.some(
          (output) => output.name === "original-output 2",
        ),
      ).toBe(true);
    });

    it("should handle multiple nodes", () => {
      const taskSpec1 = { ...mockTaskSpec };
      const taskSpec2 = { ...mockTaskSpec };

      const componentSpec = createMockComponentSpec({
        task1: taskSpec1,
        task2: taskSpec2,
      });

      const nodes = [
        createMockTaskNode("task1", taskSpec1, { x: 100, y: 100 }),
        createMockTaskNode("task2", taskSpec2, { x: 200, y: 200 }),
      ];

      const result = duplicateNodes(componentSpec, nodes);

      expect(result.newNodes).toHaveLength(2);
      expect(result.newNodes.map((n) => n.id)).toEqual([
        taskIdToNodeId("task1 2"),
        taskIdToNodeId("task2 2"),
      ]);
    });
  });

  describe("configuration options", () => {
    it("should respect selected: false config", () => {
      const componentSpec = createMockComponentSpec({
        "original-task": mockTaskSpec,
      });

      const taskNode = createMockTaskNode("original-task", mockTaskSpec);
      taskNode.selected = true;

      const result = duplicateNodes(componentSpec, [taskNode], {
        selected: false,
      });

      expect(result.newNodes[0].selected).toBe(false);
      expect(taskNode.selected).toBe(true);
    });

    it("should position nodes at specified location", () => {
      const componentSpec = createMockComponentSpec({
        task1: mockTaskSpec,
        task2: mockTaskSpec,
      });

      const nodes = [
        createMockTaskNode("task1", mockTaskSpec, { x: 100, y: 100 }),
        createMockTaskNode("task2", mockTaskSpec, { x: 200, y: 200 }),
      ];

      const result = duplicateNodes(componentSpec, nodes, {
        position: { x: 500, y: 500 },
      });

      // Note: expected positions are calculated to account for node dimensions
      expect(result.newNodes[0].position).toEqual({ x: 295, y: 345 });
      expect(result.newNodes[1].position).toEqual({ x: 395, y: 445 });
    });
  });

  describe("connection modes", () => {
    const createConnectedTasks = () => {
      const task1: TaskSpec = {
        ...mockTaskSpec,
        arguments: {},
      };

      const task2: TaskSpec = {
        ...mockTaskSpec,
        arguments: {
          input1: {
            taskOutput: {
              taskId: "task1",
              outputName: "output1",
            },
          },
        },
      };

      const task3: TaskSpec = {
        ...mockTaskSpec,
        arguments: {
          input1: {
            taskOutput: {
              taskId: "task1",
              outputName: "output1",
            },
          },
        },
      };

      return { task1, task2, task3 };
    };

    it("should handle connection mode: none", () => {
      const { task1, task2 } = createConnectedTasks();
      const componentSpec = createMockComponentSpec({
        task1,
        task2,
      });

      const nodes = [
        createMockTaskNode("task1", task1),
        createMockTaskNode("task2", task2),
      ];

      const result = duplicateNodes(componentSpec, nodes, {
        connection: "none",
      });

      if ("graph" in result.updatedComponentSpec.implementation!) {
        const duplicatedTask2 =
          result.updatedComponentSpec.implementation.graph.tasks["task2 2"];
        expect(duplicatedTask2.arguments).toEqual({});
      }
    });

    it("should handle connection mode: internal", () => {
      const { task1, task2 } = createConnectedTasks();
      const componentSpec = createMockComponentSpec({
        task1,
        task2,
      });

      const nodes = [
        createMockTaskNode("task1", task1),
        createMockTaskNode("task2", task2),
      ];

      const result = duplicateNodes(componentSpec, nodes, {
        connection: "internal",
      });

      if ("graph" in result.updatedComponentSpec.implementation!) {
        const duplicatedTask2 =
          result.updatedComponentSpec.implementation.graph.tasks["task2 2"];
        expect(duplicatedTask2.arguments?.input1).toEqual({
          taskOutput: {
            taskId: "task1 2",
            outputName: "output1",
          },
        });
      }
    });

    it("should handle connection mode: external", () => {
      // Create a scenario where we duplicate some nodes but not others
      const task1: TaskSpec = { ...mockTaskSpec, arguments: {} };
      const task2: TaskSpec = { ...mockTaskSpec, arguments: {} };
      const task3: TaskSpec = { ...mockTaskSpec, arguments: {} };

      const task2WithConnections: TaskSpec = {
        ...task2,
        arguments: {
          input1: {
            taskOutput: {
              taskId: "task1", // Internal connection (task1 will be duplicated)
              outputName: "output1",
            },
          },
          input2: {
            taskOutput: {
              taskId: "task3", // External connection (task3 won't be duplicated)
              outputName: "output1",
            },
          },
        },
      };

      const componentSpec = createMockComponentSpec({
        task1,
        task2: task2WithConnections,
        task3,
      });

      // Duplicate task1 and task2, but NOT task3
      const nodes = [
        createMockTaskNode("task1", task1),
        createMockTaskNode("task2", task2WithConnections),
      ];

      const result = duplicateNodes(componentSpec, nodes, {
        connection: "external",
      });

      if ("graph" in result.updatedComponentSpec.implementation!) {
        const duplicatedTask2 =
          result.updatedComponentSpec.implementation.graph.tasks["task2 2"];

        // Should remove internal connection to task1 (since task1 is being duplicated)
        expect(duplicatedTask2.arguments?.input1).toBeUndefined();

        // Should keep external connection to task3 (since task3 is NOT being duplicated)
        expect(duplicatedTask2.arguments?.input2).toEqual({
          taskOutput: {
            taskId: "task3",
            outputName: "output1",
          },
        });
      }
    });

    it("should handle connection mode: all", () => {
      const { task1, task2 } = createConnectedTasks();
      const componentSpec = createMockComponentSpec({
        task1,
        task2,
      });

      const nodes = [
        createMockTaskNode("task1", task1),
        createMockTaskNode("task2", task2),
      ];

      const result = duplicateNodes(componentSpec, nodes, {
        connection: "all",
      });

      if ("graph" in result.updatedComponentSpec.implementation!) {
        const duplicatedTask2 =
          result.updatedComponentSpec.implementation.graph.tasks["task2 2"];
        expect(duplicatedTask2.arguments?.input1).toEqual({
          taskOutput: {
            taskId: "task1 2",
            outputName: "output1",
          },
        });
      }
    });

    it("should handle graph input connections", () => {
      const inputSpec: InputSpec = {
        ...mockInputSpec,
        name: "graph-input",
      };

      const taskSpec: TaskSpec = {
        ...mockTaskSpec,
        arguments: {
          input1: {
            graphInput: {
              inputName: "graph-input",
            },
          },
        },
      };

      const componentSpec = createMockComponentSpec({ task1: taskSpec }, [
        inputSpec,
      ]);

      const nodes = [
        createMockInputNode("graph-input"),
        createMockTaskNode("task1", taskSpec),
      ];

      const result = duplicateNodes(componentSpec, nodes, {
        connection: "all",
      });

      if ("graph" in result.updatedComponentSpec.implementation!) {
        const duplicatedTask =
          result.updatedComponentSpec.implementation.graph.tasks["task1 2"];
        expect(duplicatedTask.arguments?.input1).toEqual({
          graphInput: {
            inputName: "graph-input 2",
          },
        });
      }
    });

    it("should handle graph output connections", () => {
      const taskSpec: TaskSpec = {
        ...mockTaskSpec,
        arguments: {},
      };

      const outputSpec: OutputSpec = {
        ...mockOutputSpec,
        name: "graph-output",
      };

      const componentSpec = createMockComponentSpecWithOutputs(
        { task1: taskSpec },
        [],
        [outputSpec],
      );

      const nodes = [
        createMockTaskNode("task1", taskSpec),
        createMockOutputNode("graph-output"),
      ];

      const result = duplicateNodes(componentSpec, nodes, {
        connection: "all",
      });

      // Check that outputValues are updated for duplicated outputs
      if ("graph" in result.updatedComponentSpec.implementation!) {
        const outputValues =
          result.updatedComponentSpec.implementation.graph.outputValues;

        // Duplicated output should reference duplicated task
        expect(outputValues?.["graph-output 2"]).toEqual({
          taskOutput: {
            taskId: "task1 2",
            outputName: "result",
          },
        });
      }
    });
  });

  describe("edge cases", () => {
    it("should handle empty node array", () => {
      const componentSpec = createMockComponentSpec();
      const result = duplicateNodes(componentSpec, []);

      expect(result.newNodes).toHaveLength(0);
      expect(result.nodeIdMap).toEqual({});
    });

    it("should preserve node measurements", () => {
      const componentSpec = createMockComponentSpec({
        "original-task": mockTaskSpec,
      });

      const taskNode = createMockTaskNode("original-task", mockTaskSpec);
      taskNode.measured = { width: 300, height: 200 };

      const result = duplicateNodes(componentSpec, [taskNode]);

      expect(result.newNodes[0].measured).toEqual({ width: 300, height: 200 });
    });

    it("should handle nodes without position annotations", () => {
      const taskSpecWithoutPosition = {
        ...mockTaskSpec,
        annotations: {}, // No position annotation
      };

      const componentSpec = createMockComponentSpec({
        "original-task": taskSpecWithoutPosition,
      });

      const taskNode = createMockTaskNode(
        "original-task",
        taskSpecWithoutPosition,
      );

      const result = duplicateNodes(componentSpec, [taskNode]);

      expect(result.newNodes).toHaveLength(1);
      expect(result.newNodes[0].position).toEqual({ x: 110, y: 110 });
    });
  });

  describe("return values", () => {
    it("should return correct structure", () => {
      const componentSpec = createMockComponentSpec({
        "original-task": mockTaskSpec,
      });

      const taskNode = createMockTaskNode("original-task", mockTaskSpec);

      const result = duplicateNodes(componentSpec, [taskNode]);

      expect(result).toHaveProperty("updatedComponentSpec");
      expect(result).toHaveProperty("nodeIdMap");
      expect(result).toHaveProperty("newNodes");
      expect(result).toHaveProperty("updatedNodes");

      expect(result.nodeIdMap).toEqual({
        [taskIdToNodeId("original-task")]: taskIdToNodeId("original-task 2"),
      });

      expect(result.updatedNodes).toHaveLength(1);
      expect(result.updatedNodes[0]).toBe(taskNode);
    });
  });
});
