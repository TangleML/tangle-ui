// checkForOrphanedNodes.test.ts
import type { Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";

import type {
  ComponentSpec,
  GraphSpec,
  InputSpec,
} from "@/utils/componentSpec";

import { checkForOrphanedNodes } from "./checkForOrphanedNodes";

// Helper functions
const createNode = (
  id: string,
  type: "task" | "input" | "output",
  data: Record<string, any> = {},
): Node => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data,
});

const createTaskNode = (id: string, taskId: string): Node =>
  createNode(id, "task", { taskId });

const createInputNode = (id: string, label: string): Node =>
  createNode(id, "input", { label });

const createOutputNode = (id: string, label: string): Node =>
  createNode(id, "output", { label });

const createGraphSpec = (
  tasks: GraphSpec["tasks"] = {},
  inputs: InputSpec[] = [],
  outputValues: GraphSpec["outputValues"] = {},
): ComponentSpec => ({
  name: "test-component",
  description: "Test component",
  implementation: {
    graph: {
      tasks,
      outputValues,
    },
  },
  inputs,
});

// Tests
describe("checkForOrphanedNodes", () => {
  describe("empty spec", () => {
    it("should return empty array when no nodes are selected", () => {
      const spec = createGraphSpec();
      const selectedNodes: Node[] = [];

      const result = checkForOrphanedNodes(selectedNodes, spec);

      expect(result).toEqual([]);
    });

    it("should return all nodes as orphaned when spec has no connections", () => {
      const spec = createGraphSpec();
      const selectedNodes = [
        createTaskNode("task-1", "task1"),
        createInputNode("input-1", "input1"),
        createOutputNode("output-1", "output1"),
      ];

      const result = checkForOrphanedNodes(selectedNodes, spec);

      expect(result).toHaveLength(3);
      expect(result.map((n) => n.id)).toEqual([
        "task-1",
        "input-1",
        "output-1",
      ]);
    });
  });

  describe("clean spec (no orphans)", () => {
    it("should return no orphans when all tasks are connected via task outputs", () => {
      const spec = createGraphSpec({
        task1: {
          componentRef: { name: "test-component" },
          arguments: {},
        },
        task2: {
          componentRef: { name: "test-component" },
          arguments: {
            input1: {
              taskOutput: {
                taskId: "task1",
                outputName: "result",
              },
            },
          },
        },
      });

      const selectedNodes = [
        createTaskNode("task-1", "task1"),
        createTaskNode("task-2", "task2"),
      ];

      const result = checkForOrphanedNodes(selectedNodes, spec);

      expect(result).toEqual([]);
    });

    it("should return no orphans when task is connected to input", () => {
      const spec = createGraphSpec(
        {
          task1: {
            componentRef: { name: "test-component" },
            arguments: {
              input1: {
                graphInput: {
                  inputName: "myInput",
                },
              },
            },
          },
        },
        [{ name: "myInput", type: "string" }],
      );

      const selectedNodes = [
        createInputNode("input-1", "myInput"),
        createTaskNode("task-1", "task1"),
      ];

      const result = checkForOrphanedNodes(selectedNodes, spec);

      expect(result).toEqual([]);
    });

    it("should return no orphans when output is connected to task", () => {
      const spec = createGraphSpec(
        {
          task1: {
            componentRef: { name: "test-component" },
            arguments: {},
          },
        },
        [],
        {
          myOutput: {
            taskOutput: {
              taskId: "task1",
              outputName: "result",
            },
          },
        },
      );

      const selectedNodes = [
        createTaskNode("task-1", "task1"),
        createOutputNode("output-1", "myOutput"),
      ];

      const result = checkForOrphanedNodes(selectedNodes, spec);

      expect(result).toEqual([]);
    });
  });

  describe("one orphaned node", () => {
    it("should return one orphaned task when it has no connections", () => {
      const spec = createGraphSpec({
        task1: {
          componentRef: { name: "test-component" },
          arguments: {},
        },
        task2: {
          componentRef: { name: "test-component" },
          arguments: {
            input1: {
              taskOutput: {
                taskId: "task1",
                outputName: "result",
              },
            },
          },
        },
        task3: {
          componentRef: { name: "test-component" },
          arguments: {}, // Orphaned - no connections
        },
      });

      const selectedNodes = [
        createTaskNode("task-1", "task1"),
        createTaskNode("task-2", "task2"),
        createTaskNode("task-3", "task3"), // This will be orphaned
      ];

      const result = checkForOrphanedNodes(selectedNodes, spec);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("task-3");
    });

    it("should return one orphaned input when no task uses it", () => {
      const spec = createGraphSpec(
        {
          task1: {
            componentRef: { name: "test-component" },
            arguments: {
              input1: {
                graphInput: {
                  inputName: "usedInput",
                },
              },
            },
          },
        },
        [
          { name: "usedInput", type: "string" },
          { name: "unusedInput", type: "string" },
        ],
      );

      const selectedNodes = [
        createInputNode("input-1", "usedInput"),
        createInputNode("input-2", "unusedInput"), // This will be orphaned
        createTaskNode("task-1", "task1"),
      ];

      const result = checkForOrphanedNodes(selectedNodes, spec);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("input-2");
    });
  });

  describe("multiple orphaned nodes", () => {
    it("should return three orphaned nodes", () => {
      const spec = createGraphSpec({
        task1: {
          componentRef: { name: "test-component" },
          arguments: {
            input1: {
              taskOutput: {
                taskId: "task2",
                outputName: "result",
              },
            },
          },
        },
        task2: {
          componentRef: { name: "test-component" },
          arguments: {},
        },
        task3: {
          componentRef: { name: "test-component" },
          arguments: {}, // Orphaned
        },
        task4: {
          componentRef: { name: "test-component" },
          arguments: {}, // Orphaned
        },
        task5: {
          componentRef: { name: "test-component" },
          arguments: {}, // Orphaned
        },
      });

      const selectedNodes = [
        createTaskNode("task-1", "task1"),
        createTaskNode("task-2", "task2"),
        createTaskNode("task-3", "task3"), // Orphaned
        createTaskNode("task-4", "task4"), // Orphaned
        createTaskNode("task-5", "task5"), // Orphaned
      ];

      const result = checkForOrphanedNodes(selectedNodes, spec);

      expect(result).toHaveLength(3);
      expect(result.map((n) => n.id).sort()).toEqual([
        "task-3",
        "task-4",
        "task-5",
      ]);
    });
  });

  describe("multiple isolated sets of connected nodes", () => {
    it("should return no orphans when there are multiple isolated but internally connected groups", () => {
      const spec = createGraphSpec(
        {
          // First connected group: input1 -> task1 -> task2 -> output1
          task1: {
            componentRef: { name: "test-component" },
            arguments: {
              input1: {
                graphInput: {
                  inputName: "input1",
                },
              },
            },
          },
          task2: {
            componentRef: { name: "test-component" },
            arguments: {
              input1: {
                taskOutput: {
                  taskId: "task1",
                  outputName: "result",
                },
              },
            },
          },
          // Second connected group: input2 -> task3 -> task4 -> output2
          task3: {
            componentRef: { name: "test-component" },
            arguments: {
              input1: {
                graphInput: {
                  inputName: "input2",
                },
              },
            },
          },
          task4: {
            componentRef: { name: "test-component" },
            arguments: {
              input1: {
                taskOutput: {
                  taskId: "task3",
                  outputName: "result",
                },
              },
            },
          },
        },
        [
          { name: "input1", type: "string" },
          { name: "input2", type: "string" },
        ],
        {
          output1: {
            taskOutput: {
              taskId: "task2",
              outputName: "result",
            },
          },
          output2: {
            taskOutput: {
              taskId: "task4",
              outputName: "result",
            },
          },
        },
      );

      const selectedNodes = [
        // First group
        createInputNode("input-1", "input1"),
        createTaskNode("task-1", "task1"),
        createTaskNode("task-2", "task2"),
        createOutputNode("output-1", "output1"),
        // Second group
        createInputNode("input-2", "input2"),
        createTaskNode("task-3", "task3"),
        createTaskNode("task-4", "task4"),
        createOutputNode("output-2", "output2"),
      ];

      const result = checkForOrphanedNodes(selectedNodes, spec);

      expect(result).toEqual([]);
    });

    it("should return no orphans for a single connected chain", () => {
      const spec = createGraphSpec(
        {
          task1: {
            componentRef: { name: "test-component" },
            arguments: {
              input1: {
                graphInput: {
                  inputName: "myInput",
                },
              },
            },
          },
          task2: {
            componentRef: { name: "test-component" },
            arguments: {
              input1: {
                taskOutput: {
                  taskId: "task1",
                  outputName: "result",
                },
              },
            },
          },
          task3: {
            componentRef: { name: "test-component" },
            arguments: {
              input1: {
                taskOutput: {
                  taskId: "task2",
                  outputName: "result",
                },
              },
            },
          },
        },
        [{ name: "myInput", type: "string" }],
        {
          myOutput: {
            taskOutput: {
              taskId: "task3",
              outputName: "result",
            },
          },
        },
      );

      const selectedNodes = [
        createInputNode("input-1", "myInput"),
        createTaskNode("task-1", "task1"),
        createTaskNode("task-2", "task2"),
        createTaskNode("task-3", "task3"),
        createOutputNode("output-1", "myOutput"),
      ];

      const result = checkForOrphanedNodes(selectedNodes, spec);

      expect(result).toEqual([]);
    });
  });

  describe("non-graph implementation", () => {
    it("should return empty array for non-graph implementation", () => {
      const spec: ComponentSpec = {
        name: "test-component",
        description: "Test component",
        implementation: {
          container: {
            image: "python:3.9",
            command: ["python"],
            args: ["-c", "print('hello')"],
          },
        },
      };

      const selectedNodes = [
        createTaskNode("task-1", "task1"),
        createInputNode("input-1", "input1"),
      ];

      const result = checkForOrphanedNodes(selectedNodes, spec);

      expect(result).toEqual([]);
    });
  });
});
