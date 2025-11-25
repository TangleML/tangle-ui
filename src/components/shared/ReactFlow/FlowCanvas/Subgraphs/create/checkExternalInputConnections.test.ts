import type { Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";

import type { ComponentSpec, GraphSpec } from "@/utils/componentSpec";

import { checkExternalInputConnections } from "./checkExternalInputConnections";

// Helper to create a node
const createNode = (
  id: string,
  type: "task" | "input" | "output",
  data: Record<string, any>,
): Node => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data,
});

// Helper to create a task node
const createTaskNode = (id: string, taskId: string): Node =>
  createNode(id, "task", { taskId });

// Helper to create an input node
const createInputNode = (id: string, label: string): Node =>
  createNode(id, "input", { label });

// Helper to create a component spec with graph implementation
const createGraphSpec = (
  tasks: GraphSpec["tasks"] = {},
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
});

describe("checkExternalInputConnections", () => {
  describe("no external connections", () => {
    it("should return empty array when no input nodes are selected", () => {
      const spec = createGraphSpec({
        task1: {
          componentRef: { name: "test-component" },
          arguments: {},
        },
      });

      const selectedNodes = [createTaskNode("task-1", "task1")];

      const result = checkExternalInputConnections(selectedNodes, spec);

      expect(result).toEqual([]);
    });

    it("should return empty array when input has no connections at all", () => {
      const spec = createGraphSpec({
        task1: {
          componentRef: { name: "test-component" },
          arguments: {},
        },
      });

      const selectedNodes = [
        createInputNode("input-1", "myInput"),
        createTaskNode("task-1", "task1"),
      ];

      const result = checkExternalInputConnections(selectedNodes, spec);

      expect(result).toEqual([]);
    });

    it("should return empty array when input is only connected to selected tasks", () => {
      const spec = createGraphSpec({
        task1: {
          componentRef: { name: "test-component" },
          arguments: {
            input1: {
              graphInput: {
                inputName: "myInput",
                type: "string",
              },
            },
          },
        },
      });

      const selectedNodes = [
        createInputNode("input-1", "myInput"),
        createTaskNode("task-1", "task1"),
      ];

      const result = checkExternalInputConnections(selectedNodes, spec);

      expect(result).toEqual([]);
    });

    it("should return empty array when input is connected internally only", () => {
      const spec = createGraphSpec({
        task1: {
          componentRef: { name: "test-component" },
          arguments: {
            input1: {
              graphInput: {
                inputName: "myInput",
                type: "string",
              },
            },
          },
        },
        task2: {
          componentRef: { name: "test-component" },
          arguments: {
            input1: {
              graphInput: {
                inputName: "myInput",
                type: "string",
              },
            },
          },
        },
      });

      const selectedNodes = [
        createInputNode("input-1", "myInput"),
        createTaskNode("task-1", "task1"),
        createTaskNode("task-2", "task2"),
      ];

      const result = checkExternalInputConnections(selectedNodes, spec);

      expect(result).toEqual([]);
    });
  });

  describe("with external connections", () => {
    it("should return input node when connected to external task", () => {
      const spec = createGraphSpec({
        internalTask: {
          componentRef: { name: "test-component" },
          arguments: {
            input1: {
              graphInput: {
                inputName: "myInput",
                type: "string",
              },
            },
          },
        },
        externalTask: {
          componentRef: { name: "test-component" },
          arguments: {
            input1: {
              graphInput: {
                inputName: "myInput",
                type: "string",
              },
            },
          },
        },
      });

      const selectedNodes = [
        createInputNode("input-1", "myInput"),
        createTaskNode("task-1", "internalTask"),
      ];

      const result = checkExternalInputConnections(selectedNodes, spec);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("input-1");
      expect(result[0].data.label).toBe("myInput");
    });

    it("should return input node when connected ONLY to external task", () => {
      const spec = createGraphSpec({
        externalTask: {
          componentRef: { name: "test-component" },
          arguments: {
            input1: {
              graphInput: {
                inputName: "myInput",
                type: "string",
              },
            },
          },
        },
      });

      const selectedNodes = [
        createInputNode("input-1", "myInput"),
        createTaskNode("task-1", "someOtherTask"),
      ];

      const result = checkExternalInputConnections(selectedNodes, spec);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("input-1");
    });

    it("should return multiple input nodes when multiple have external connections", () => {
      const spec = createGraphSpec({
        internalTask: {
          componentRef: { name: "test-component" },
          arguments: {},
        },
        externalTask1: {
          componentRef: { name: "test-component" },
          arguments: {
            input1: {
              graphInput: {
                inputName: "input1",
                type: "string",
              },
            },
          },
        },
        externalTask2: {
          componentRef: { name: "test-component" },
          arguments: {
            input1: {
              graphInput: {
                inputName: "input2",
                type: "string",
              },
            },
          },
        },
      });

      const selectedNodes = [
        createInputNode("input-1", "input1"),
        createInputNode("input-2", "input2"),
        createTaskNode("task-1", "internalTask"),
      ];

      const result = checkExternalInputConnections(selectedNodes, spec);

      expect(result).toHaveLength(2);
      expect(result.map((n) => n.id).sort()).toEqual(["input-1", "input-2"]);
    });

    it("should only return inputs with external connections, not all selected inputs", () => {
      const spec = createGraphSpec({
        internalTask: {
          componentRef: { name: "test-component" },
          arguments: {
            input1: {
              graphInput: {
                inputName: "internalInput",
                type: "string",
              },
            },
          },
        },
        externalTask: {
          componentRef: { name: "test-component" },
          arguments: {
            input1: {
              graphInput: {
                inputName: "externalInput",
                type: "string",
              },
            },
          },
        },
      });

      const selectedNodes = [
        createInputNode("input-1", "internalInput"),
        createInputNode("input-2", "externalInput"),
        createInputNode("input-3", "unusedInput"),
        createTaskNode("task-1", "internalTask"),
      ];

      const result = checkExternalInputConnections(selectedNodes, spec);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("input-2");
      expect(result[0].data.label).toBe("externalInput");
    });

    it("should detect external connection when input used by multiple external tasks", () => {
      const spec = createGraphSpec({
        internalTask: {
          componentRef: { name: "test-component" },
          arguments: {},
        },
        externalTask1: {
          componentRef: { name: "test-component" },
          arguments: {
            input1: {
              graphInput: {
                inputName: "sharedInput",
                type: "string",
              },
            },
          },
        },
        externalTask2: {
          componentRef: { name: "test-component" },
          arguments: {
            input1: {
              graphInput: {
                inputName: "sharedInput",
                type: "string",
              },
            },
          },
        },
      });

      const selectedNodes = [
        createInputNode("input-1", "sharedInput"),
        createTaskNode("task-1", "internalTask"),
      ];

      const result = checkExternalInputConnections(selectedNodes, spec);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("input-1");
    });

    it("should handle mixed internal and external connections", () => {
      const spec = createGraphSpec({
        internalTask1: {
          componentRef: { name: "test-component" },
          arguments: {
            input1: {
              graphInput: {
                inputName: "myInput",
                type: "string",
              },
            },
          },
        },
        internalTask2: {
          componentRef: { name: "test-component" },
          arguments: {
            input1: {
              graphInput: {
                inputName: "myInput",
                type: "string",
              },
            },
          },
        },
        externalTask: {
          componentRef: { name: "test-component" },
          arguments: {
            input1: {
              graphInput: {
                inputName: "myInput",
                type: "string",
              },
            },
          },
        },
      });

      const selectedNodes = [
        createInputNode("input-1", "myInput"),
        createTaskNode("task-1", "internalTask1"),
        createTaskNode("task-2", "internalTask2"),
      ];

      const result = checkExternalInputConnections(selectedNodes, spec);

      // Should still detect the external connection even with internal ones
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("input-1");
    });
  });

  describe("edge cases", () => {
    it("should return empty array for non-graph implementation", () => {
      const spec: ComponentSpec = {
        name: "test-component",
        description: "Test component",
        implementation: {
          container: {
            image: "test:latest",
          },
        },
      };

      const selectedNodes = [
        createInputNode("input-1", "myInput"),
        createTaskNode("task-1", "task1"),
      ];

      const result = checkExternalInputConnections(selectedNodes, spec);

      expect(result).toEqual([]);
    });

    it("should handle empty selection", () => {
      const spec = createGraphSpec({
        task1: {
          componentRef: { name: "test-component" },
          arguments: {},
        },
      });

      const selectedNodes: Node[] = [];

      const result = checkExternalInputConnections(selectedNodes, spec);

      expect(result).toEqual([]);
    });

    it("should handle tasks with no arguments", () => {
      const spec = createGraphSpec({
        task1: {
          componentRef: { name: "test-component" },
          // No arguments property
        },
      });

      const selectedNodes = [
        createInputNode("input-1", "myInput"),
        createTaskNode("task-1", "task1"),
      ];

      const result = checkExternalInputConnections(selectedNodes, spec);

      expect(result).toEqual([]);
    });

    it("should handle input node with missing label", () => {
      const spec = createGraphSpec({
        task1: {
          componentRef: { name: "test-component" },
          arguments: {
            input1: {
              graphInput: {
                inputName: "myInput",
                type: "string",
              },
            },
          },
        },
      });

      const selectedNodes = [
        createNode("input-1", "input", {}), // Missing label
        createTaskNode("task-1", "someOtherTask"),
      ];

      const result = checkExternalInputConnections(selectedNodes, spec);

      expect(result).toEqual([]);
    });

    it("should ignore non-graphInput arguments", () => {
      const spec = createGraphSpec({
        task1: {
          componentRef: { name: "test-component" },
          arguments: {
            input1: {
              taskOutput: {
                taskId: "task0",
                outputName: "result",
                type: "string",
              },
            },
          },
        },
      });

      const selectedNodes = [
        createInputNode("input-1", "myInput"),
        createTaskNode("task-1", "someOtherTask"),
      ];

      const result = checkExternalInputConnections(selectedNodes, spec);

      expect(result).toEqual([]);
    });

    it("should handle tasks that reference inputs with different names", () => {
      const spec = createGraphSpec({
        externalTask: {
          componentRef: { name: "test-component" },
          arguments: {
            input1: {
              graphInput: {
                inputName: "differentInput",
                type: "string",
              },
            },
          },
        },
      });

      const selectedNodes = [
        createInputNode("input-1", "myInput"),
        createTaskNode("task-1", "someOtherTask"),
      ];

      const result = checkExternalInputConnections(selectedNodes, spec);

      expect(result).toEqual([]);
    });
  });

  describe("complex scenarios", () => {
    it("should handle large selection with multiple inputs and tasks", () => {
      const spec = createGraphSpec({
        internal1: {
          componentRef: { name: "test-component" },
          arguments: {
            input1: {
              graphInput: {
                inputName: "input1",
                type: "string",
              },
            },
          },
        },
        internal2: {
          componentRef: { name: "test-component" },
          arguments: {
            input1: {
              graphInput: {
                inputName: "input2",
                type: "string",
              },
            },
          },
        },
        external1: {
          componentRef: { name: "test-component" },
          arguments: {
            input1: {
              graphInput: {
                inputName: "input1",
                type: "string",
              },
            },
          },
        },
        external2: {
          componentRef: { name: "test-component" },
          arguments: {
            input1: {
              graphInput: {
                inputName: "input3",
                type: "string",
              },
            },
          },
        },
      });

      const selectedNodes = [
        createInputNode("input-1", "input1"),
        createInputNode("input-2", "input2"),
        createInputNode("input-3", "input3"),
        createTaskNode("task-1", "internal1"),
        createTaskNode("task-2", "internal2"),
      ];

      const result = checkExternalInputConnections(selectedNodes, spec);

      // input1 has external connection (external1)
      // input2 has no external connection
      // input3 has external connection (external2) but no internal connection
      expect(result).toHaveLength(2);
      expect(result.map((n) => n.data.label).sort()).toEqual([
        "input1",
        "input3",
      ]);
    });
  });
});
