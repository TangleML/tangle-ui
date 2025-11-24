import type { Node } from "@xyflow/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  type ComponentSpec,
  type GraphSpec,
  isGraphImplementation,
} from "@/utils/componentSpec";

import {
  createSubgraphFromNodes,
  GRAPH_OUTPUT,
  PLACEHOLDER_SUBGRAPH_ID,
} from "./createSubgraphFromNodes";

// Mock the services
vi.mock("@/services/componentService", () => ({
  generateDigest: vi.fn().mockResolvedValue("mock-digest"),
  getComponentText: vi.fn().mockResolvedValue("mock-component-text"),
}));

vi.mock("@/utils/user", () => ({
  getUserDetails: vi.fn().mockResolvedValue({ id: "test-user" }),
}));

// Helper to create a node
const createNode = (
  id: string,
  type: "task" | "input" | "output",
  data: Record<string, any>,
  position: { x: number; y: number } = { x: 0, y: 0 },
): Node => ({
  id,
  type,
  position,
  data,
  measured: { width: 200, height: 100 },
});

// Helper to create a task node
const createTaskNode = (
  id: string,
  taskId: string,
  position: { x: number; y: number } = { x: 0, y: 0 },
): Node => createNode(id, "task", { taskId }, position);

// Helper to create an input node
const createInputNode = (
  id: string,
  label: string,
  type: string = "string",
  position: { x: number; y: number } = { x: 0, y: 0 },
): Node => createNode(id, "input", { label, type, optional: false }, position);

// Helper to create an output node
const createOutputNode = (
  id: string,
  label: string,
  type: string = "string",
  position: { x: number; y: number } = { x: 0, y: 0 },
): Node => createNode(id, "output", { label, type }, position);

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

describe("createSubgraphFromNodes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("basic subgraph creation", () => {
    it("should create a subgraph from a single task", async () => {
      const spec = createGraphSpec({
        task1: {
          componentRef: {
            name: "test-task",
            spec: {
              name: "test-task",
              description: "Test task",
              outputs: [{ name: "result", type: "string" }],
              implementation: {
                container: {
                  image: "test:latest",
                },
              },
            },
          },
          arguments: {},
        },
      });

      const selectedNodes = [
        createTaskNode("node-1", "task1", { x: 100, y: 100 }),
      ];

      const result = await createSubgraphFromNodes(
        selectedNodes,
        spec,
        "MySubgraph",
      );

      expect(result.subgraphTask).toBeDefined();
      expect(result.subgraphTask.componentRef.name).toBe("MySubgraph");

      if (
        !isGraphImplementation(
          result.subgraphTask.componentRef.spec!.implementation,
        )
      ) {
        throw new Error("Subgraph implementation is not a graph");
      }

      expect(
        result.subgraphTask.componentRef.spec?.implementation.graph?.tasks,
      ).toHaveProperty("task1");
      expect(result.connectionMappings).toEqual([]);
    });

    it("should create a subgraph from multiple connected tasks", async () => {
      const spec = createGraphSpec({
        task1: {
          componentRef: {
            name: "task1-component",
            spec: {
              name: "task1-component",
              description: "Task 1",
              outputs: [{ name: "output1", type: "string" }],
              implementation: {
                container: { image: "test:latest" },
              },
            },
          },
          arguments: {},
        },
        task2: {
          componentRef: {
            name: "task2-component",
            spec: {
              name: "task2-component",
              description: "Task 2",
              inputs: [{ name: "input1", type: "string" }],
              implementation: {
                container: { image: "test:latest" },
              },
            },
          },
          arguments: {
            input1: {
              taskOutput: {
                taskId: "task1",
                outputName: "output1",
                type: "string",
              },
            },
          },
        },
      });

      const selectedNodes = [
        createTaskNode("node-1", "task1", { x: 0, y: 0 }),
        createTaskNode("node-2", "task2", { x: 300, y: 0 }),
      ];

      const result = await createSubgraphFromNodes(selectedNodes, spec);

      if (
        !isGraphImplementation(
          result.subgraphTask.componentRef.spec!.implementation,
        )
      ) {
        throw new Error("Subgraph implementation is not a graph");
      }

      expect(
        result.subgraphTask.componentRef.spec?.implementation.graph?.tasks,
      ).toHaveProperty("task1");
      expect(
        result.subgraphTask.componentRef.spec?.implementation.graph?.tasks,
      ).toHaveProperty("task2");

      const task2 =
        result.subgraphTask.componentRef.spec?.implementation.graph?.tasks
          .task2;
      expect(task2?.arguments?.input1).toEqual({
        taskOutput: {
          taskId: "task1",
          outputName: "output1",
          type: "string",
        },
      });
    });

    it("should normalize node positions relative to bounds", async () => {
      const spec = createGraphSpec({
        task1: {
          componentRef: {
            name: "test-task",
            spec: {
              name: "test-task",
              description: "Test",
              implementation: {
                container: { image: "test:latest" },
              },
            },
          },
          arguments: {},
        },
      });

      const selectedNodes = [
        createTaskNode("node-1", "task1", { x: 500, y: 300 }),
      ];

      const result = await createSubgraphFromNodes(selectedNodes, spec);

      if (
        !isGraphImplementation(
          result.subgraphTask.componentRef.spec!.implementation,
        )
      ) {
        throw new Error("Subgraph implementation is not a graph");
      }

      const task1 =
        result.subgraphTask.componentRef.spec?.implementation.graph?.tasks
          .task1;
      const position = JSON.parse(
        task1?.annotations?.["editor.position"] as string,
      );

      // Position should be normalized (close to 0,0 since it's the only node)
      expect(position.x).toBeLessThan(100);
      expect(position.y).toBeLessThan(100);
    });
  });

  describe("external input connections", () => {
    it("should create subgraph input for external task output connection", async () => {
      const spec = createGraphSpec({
        externalTask: {
          componentRef: {
            name: "external",
            spec: {
              name: "external",
              description: "External task",
              outputs: [{ name: "result", type: "string" }],
              implementation: {
                container: { image: "test:latest" },
              },
            },
          },
          arguments: {},
        },
        task1: {
          componentRef: {
            name: "internal",
            spec: {
              name: "internal",
              description: "Internal task",
              inputs: [{ name: "input1", type: "string" }],
              implementation: {
                container: { image: "test:latest" },
              },
            },
          },
          arguments: {
            input1: {
              taskOutput: {
                taskId: "externalTask",
                outputName: "result",
                type: "string",
              },
            },
          },
        },
      });

      const selectedNodes = [createTaskNode("node-1", "task1")];

      const result = await createSubgraphFromNodes(selectedNodes, spec);

      const subgraphSpec = result.subgraphTask.componentRef.spec;

      // Should create a subgraph input
      expect(subgraphSpec?.inputs).toHaveLength(1);
      expect(subgraphSpec?.inputs?.[0].type).toBe("string");

      // Should wire the subgraph argument to external source
      expect(result.subgraphTask.arguments).toBeDefined();
      const argValue = Object.values(result.subgraphTask.arguments!)[0];
      expect(argValue).toEqual({
        taskOutput: {
          taskId: "externalTask",
          outputName: "result",
          type: "string",
        },
      });
    });

    it("should create subgraph input for external graph input connection", async () => {
      const spec: ComponentSpec = {
        name: "test-component",
        description: "Test",
        inputs: [{ name: "externalInput", type: "string" }],
        implementation: {
          graph: {
            tasks: {
              task1: {
                componentRef: {
                  name: "test-task",
                  spec: {
                    name: "test-task",
                    description: "Test",
                    inputs: [{ name: "input1", type: "string" }],
                    implementation: {
                      container: { image: "test:latest" },
                    },
                  },
                },
                arguments: {
                  input1: {
                    graphInput: {
                      inputName: "externalInput",
                      type: "string",
                    },
                  },
                },
              },
            },
          },
        },
      };

      const selectedNodes = [createTaskNode("node-1", "task1")];

      const result = await createSubgraphFromNodes(selectedNodes, spec);

      const subgraphSpec = result.subgraphTask.componentRef.spec;

      // Should create a subgraph input
      expect(subgraphSpec?.inputs).toHaveLength(1);

      // Should wire the subgraph argument to external input
      expect(result.subgraphTask.arguments).toBeDefined();
      const argValue = Object.values(result.subgraphTask.arguments!)[0];
      expect(argValue).toEqual({
        graphInput: {
          inputName: "externalInput",
          type: "string",
        },
      });
    });

    it("should reuse existing subgraph input for multiple tasks with same external connection", async () => {
      const spec = createGraphSpec({
        externalTask: {
          componentRef: {
            name: "external",
            spec: {
              name: "external",
              description: "External",
              outputs: [{ name: "result", type: "string" }],
              implementation: {
                container: { image: "test:latest" },
              },
            },
          },
          arguments: {},
        },
        task1: {
          componentRef: {
            name: "internal1",
            spec: {
              name: "internal1",
              description: "Internal 1",
              inputs: [{ name: "input1", type: "string" }],
              implementation: {
                container: { image: "test:latest" },
              },
            },
          },
          arguments: {
            input1: {
              taskOutput: {
                taskId: "externalTask",
                outputName: "result",
                type: "string",
              },
            },
          },
        },
        task2: {
          componentRef: {
            name: "internal2",
            spec: {
              name: "internal2",
              description: "Internal 2",
              inputs: [{ name: "input1", type: "string" }],
              implementation: {
                container: { image: "test:latest" },
              },
            },
          },
          arguments: {
            input1: {
              taskOutput: {
                taskId: "externalTask",
                outputName: "result",
                type: "string",
              },
            },
          },
        },
      });

      const selectedNodes = [
        createTaskNode("node-1", "task1"),
        createTaskNode("node-2", "task2"),
      ];

      const result = await createSubgraphFromNodes(selectedNodes, spec);

      const subgraphSpec = result.subgraphTask.componentRef.spec;

      if (!isGraphImplementation(subgraphSpec!.implementation)) {
        throw new Error("Subgraph implementation is not a graph");
      }

      // Should only create ONE subgraph input for both tasks
      expect(subgraphSpec?.inputs).toHaveLength(1);

      // Both tasks should reference the same input
      const task1Args =
        subgraphSpec?.implementation.graph?.tasks.task1.arguments;
      const task2Args =
        subgraphSpec?.implementation.graph?.tasks.task2.arguments;
      expect(task1Args?.input1).toEqual(task2Args?.input1);
    });
  });

  describe("external output connections", () => {
    it("should create subgraph output for task consumed by external task", async () => {
      const spec = createGraphSpec({
        task1: {
          componentRef: {
            name: "internal",
            spec: {
              name: "internal",
              description: "Internal",
              outputs: [{ name: "result", type: "string" }],
              implementation: {
                container: { image: "test:latest" },
              },
            },
          },
          arguments: {},
        },
        externalTask: {
          componentRef: {
            name: "external",
            spec: {
              name: "external",
              description: "External",
              inputs: [{ name: "input1", type: "string" }],
              implementation: {
                container: { image: "test:latest" },
              },
            },
          },
          arguments: {
            input1: {
              taskOutput: {
                taskId: "task1",
                outputName: "result",
                type: "string",
              },
            },
          },
        },
      });

      const selectedNodes = [createTaskNode("node-1", "task1")];

      const result = await createSubgraphFromNodes(selectedNodes, spec);

      const subgraphSpec = result.subgraphTask.componentRef.spec;

      if (!isGraphImplementation(subgraphSpec!.implementation)) {
        throw new Error("Subgraph implementation is not a graph");
      }

      // Should create a subgraph output
      expect(subgraphSpec?.outputs).toHaveLength(1);
      expect(subgraphSpec?.outputs?.[0].type).toBe("string");

      // Should have output value pointing to internal task
      expect(subgraphSpec?.implementation.graph?.outputValues).toBeDefined();
      const outputValue = Object.values(
        subgraphSpec!.implementation.graph!.outputValues!,
      )[0];
      expect(outputValue.taskOutput.taskId).toBe("task1");
      expect(outputValue.taskOutput.outputName).toBe("result");

      // Should create connection mapping
      expect(result.connectionMappings).toHaveLength(1);
      expect(result.connectionMappings[0]).toMatchObject({
        originalTaskId: "task1",
        originalOutputName: "result",
        newTaskId: PLACEHOLDER_SUBGRAPH_ID,
        targetTaskId: "externalTask",
        targetInputName: "input1",
      });
    });

    it("should create subgraph output for task consumed by external graph output", async () => {
      const spec = createGraphSpec(
        {
          task1: {
            componentRef: {
              name: "internal",
              spec: {
                name: "internal",
                description: "Internal",
                outputs: [{ name: "result", type: "string" }],
                implementation: {
                  container: { image: "test:latest" },
                },
              },
            },
            arguments: {},
          },
        },
        {
          graphOutput: {
            taskOutput: {
              taskId: "task1",
              outputName: "result",
              type: "string",
            },
          },
        },
      );

      const selectedNodes = [createTaskNode("node-1", "task1")];

      const result = await createSubgraphFromNodes(selectedNodes, spec);

      const subgraphSpec = result.subgraphTask.componentRef.spec;

      // Should create a subgraph output
      expect(subgraphSpec?.outputs).toHaveLength(1);

      // Should create connection mapping to GRAPH_OUTPUT
      expect(result.connectionMappings).toHaveLength(1);
      expect(result.connectionMappings[0]).toMatchObject({
        originalTaskId: "task1",
        originalOutputName: "result",
        newTaskId: PLACEHOLDER_SUBGRAPH_ID,
        targetTaskId: GRAPH_OUTPUT,
        targetInputName: "graphOutput",
      });
    });
  });

  describe("selected input and output nodes", () => {
    it("should include selected input nodes in subgraph", async () => {
      const spec: ComponentSpec = {
        name: "test-component",
        description: "Test",
        inputs: [{ name: "myInput", type: "string", value: "default-value" }],
        implementation: {
          graph: {
            tasks: {
              task1: {
                componentRef: {
                  name: "test-task",
                  spec: {
                    name: "test-task",
                    description: "Test",
                    inputs: [{ name: "input1", type: "string" }],
                    implementation: {
                      container: { image: "test:latest" },
                    },
                  },
                },
                arguments: {
                  input1: {
                    graphInput: {
                      inputName: "myInput",
                      type: "string",
                    },
                  },
                },
              },
            },
          },
        },
      };

      const selectedNodes = [
        createInputNode("input-1", "myInput"),
        createTaskNode("task-1", "task1"),
      ];

      const result = await createSubgraphFromNodes(selectedNodes, spec);

      const subgraphSpec = result.subgraphTask.componentRef.spec;

      // Should include the input in subgraph
      expect(subgraphSpec?.inputs).toHaveLength(1);
      expect(subgraphSpec?.inputs?.[0].name).toBe("myInput");

      // Should migrate the input value to subgraph arguments
      expect(result.subgraphTask.arguments?.myInput).toBe("default-value");
    });

    it("should include selected output nodes in subgraph", async () => {
      const spec = createGraphSpec(
        {
          task1: {
            componentRef: {
              name: "test-task",
              spec: {
                name: "test-task",
                description: "Test",
                outputs: [{ name: "result", type: "string" }],
                implementation: {
                  container: { image: "test:latest" },
                },
              },
            },
            arguments: {},
          },
        },
        {
          myOutput: {
            taskOutput: {
              taskId: "task1",
              outputName: "result",
              type: "string",
            },
          },
        },
      );

      const selectedNodes = [
        createTaskNode("task-1", "task1"),
        createOutputNode("output-1", "myOutput"),
      ];

      const result = await createSubgraphFromNodes(selectedNodes, spec);

      const subgraphSpec = result.subgraphTask.componentRef.spec;

      if (!isGraphImplementation(subgraphSpec!.implementation)) {
        throw new Error("Subgraph implementation is not a graph");
      }

      // Should include the output in subgraph
      expect(subgraphSpec?.outputs).toHaveLength(1);
      expect(subgraphSpec?.outputs?.[0].name).toBe("myOutput");

      // Should include output value
      expect(
        subgraphSpec?.implementation.graph?.outputValues?.myOutput,
      ).toEqual({
        taskOutput: {
          taskId: "task1",
          outputName: "result",
          type: "string",
        },
      });
    });
  });

  describe("edge cases", () => {
    it("should throw error for non-graph implementation", async () => {
      const spec: ComponentSpec = {
        name: "test-component",
        description: "Test",
        implementation: {
          container: {
            image: "test:latest",
          },
        },
      };

      const selectedNodes = [createTaskNode("node-1", "task1")];

      await expect(
        createSubgraphFromNodes(selectedNodes, spec),
      ).rejects.toThrow(
        "Current component spec does not have a graph implementation",
      );
    });

    it("should handle empty selection", async () => {
      const spec = createGraphSpec();
      const selectedNodes: Node[] = [];

      const result = await createSubgraphFromNodes(selectedNodes, spec);

      if (
        !isGraphImplementation(
          result.subgraphTask.componentRef.spec!.implementation,
        )
      ) {
        throw new Error("Subgraph implementation is not a graph");
      }

      expect(
        result.subgraphTask.componentRef.spec?.implementation.graph?.tasks,
      ).toEqual({});
      expect(result.connectionMappings).toEqual([]);
    });

    it("should generate unique names when name not provided", async () => {
      const spec = createGraphSpec({
        task1: {
          componentRef: {
            name: "test",
            spec: {
              name: "test",
              description: "Test",
              implementation: {
                container: { image: "test:latest" },
              },
            },
          },
          arguments: {},
        },
        "Generated Subgraph": {
          componentRef: {
            name: "existing",
            spec: {
              name: "existing",
              description: "Existing",
              implementation: {
                container: { image: "test:latest" },
              },
            },
          },
          arguments: {},
        },
      });

      const selectedNodes = [createTaskNode("node-1", "task1")];

      const result = await createSubgraphFromNodes(selectedNodes, spec);

      // Should generate a unique name (not "Generated Subgraph" since it exists)
      expect(result.subgraphTask.componentRef.name).not.toBe(
        "Generated Subgraph",
      );
      expect(result.subgraphTask.componentRef.name).toContain(
        "Generated Subgraph",
      );
    });
  });
});
