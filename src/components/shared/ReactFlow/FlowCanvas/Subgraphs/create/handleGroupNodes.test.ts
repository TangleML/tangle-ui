import type { Node } from "@xyflow/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  type ComponentSpec,
  type GraphSpec,
  isGraphImplementation,
  type TaskSpec,
} from "@/utils/componentSpec";
import { createSubgraphFromNodes } from "@/utils/nodes/createSubgraphFromNodes";

import addTask from "../../utils/addTask";
import { calculateNodesCenter } from "../../utils/geometry";
import { removeNode } from "../../utils/removeNode";
import { updateDownstreamSubgraphConnections } from "../../utils/updateDownstreamSubgraphConnections";
import { handleGroupNodes } from "./handleGroupNodes";

// Mock dependencies
vi.mock("@/utils/nodes/createSubgraphFromNodes");
vi.mock("../../utils/addTask");
vi.mock("../../utils/geometry");
vi.mock("../../utils/removeNode");
vi.mock("../../utils/updateDownstreamSubgraphConnections");
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

describe("handleGroupNodes", () => {
  let onSuccess: ReturnType<typeof vi.fn>;
  let onError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    onSuccess = vi.fn();
    onError = vi.fn();

    // Setup default mock implementations
    vi.mocked(calculateNodesCenter).mockReturnValue({ x: 100, y: 100 });
    vi.mocked(removeNode).mockImplementation((_, spec) => spec);
  });

  describe("successful grouping", () => {
    it("should group nodes and call onSuccess with updated spec", async () => {
      const spec = createGraphSpec({
        task1: {
          componentRef: { name: "component1" },
          arguments: {},
        },
        task2: {
          componentRef: { name: "component2" },
          arguments: {},
        },
      });

      if (!isGraphImplementation(spec.implementation)) {
        return;
      }

      const selectedNodes = [
        createTaskNode("node-1", "task1"),
        createTaskNode("node-2", "task2"),
      ];

      const mockSubgraphTask: TaskSpec = {
        componentRef: {
          name: "MySubgraph",
          spec: {
            name: "MySubgraph",
            description: "Subgraph",
            implementation: {
              graph: {
                tasks: {
                  task1: spec.implementation.graph!.tasks.task1,
                  task2: spec.implementation.graph!.tasks.task2,
                },
              },
            },
          },
        },
        arguments: {},
      };

      vi.mocked(createSubgraphFromNodes).mockResolvedValue({
        subgraphTask: mockSubgraphTask,
        connectionMappings: [],
      });

      const specWithNewTask = createGraphSpec({
        ...spec.implementation.graph!.tasks,
        subgraph1: mockSubgraphTask,
      });

      vi.mocked(addTask).mockReturnValue({
        spec: specWithNewTask,
        taskId: "subgraph1",
      });

      vi.mocked(updateDownstreamSubgraphConnections).mockReturnValue(
        specWithNewTask,
      );

      await handleGroupNodes(
        selectedNodes,
        spec,
        "MySubgraph",
        onSuccess,
        onError,
      );

      expect(createSubgraphFromNodes).toHaveBeenCalledWith(
        selectedNodes,
        spec,
        "MySubgraph",
      );
      expect(calculateNodesCenter).toHaveBeenCalledWith(selectedNodes);
      expect(addTask).toHaveBeenCalledWith(
        "task",
        mockSubgraphTask,
        { x: 100, y: 100 },
        spec,
      );
      expect(removeNode).toHaveBeenCalledTimes(2);
      expect(onSuccess).toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    });

    it("should calculate center position from selected nodes", async () => {
      const spec = createGraphSpec({
        task1: {
          componentRef: { name: "component1" },
          arguments: {},
        },
      });

      const selectedNodes = [
        createTaskNode("node-1", "task1", { x: 50, y: 50 }),
        createTaskNode("node-2", "task2", { x: 150, y: 150 }),
      ];

      const mockSubgraphTask: TaskSpec = {
        componentRef: {
          name: "MySubgraph",
          spec: {
            name: "MySubgraph",
            description: "Subgraph",
            implementation: {
              graph: { tasks: {} },
            },
          },
        },
        arguments: {},
      };

      vi.mocked(createSubgraphFromNodes).mockResolvedValue({
        subgraphTask: mockSubgraphTask,
        connectionMappings: [],
      });

      vi.mocked(calculateNodesCenter).mockReturnValue({ x: 100, y: 100 });

      vi.mocked(addTask).mockReturnValue({
        spec: createGraphSpec({ subgraph1: mockSubgraphTask }),
        taskId: "subgraph1",
      });

      vi.mocked(updateDownstreamSubgraphConnections).mockReturnValue(
        createGraphSpec({ subgraph1: mockSubgraphTask }),
      );

      await handleGroupNodes(
        selectedNodes,
        spec,
        "MySubgraph",
        onSuccess,
        onError,
      );

      expect(calculateNodesCenter).toHaveBeenCalledWith(selectedNodes);
      expect(addTask).toHaveBeenCalledWith(
        "task",
        mockSubgraphTask,
        { x: 100, y: 100 },
        spec,
      );
    });

    it("should remove all selected nodes from parent spec", async () => {
      const spec = createGraphSpec({
        task1: {
          componentRef: { name: "component1" },
          arguments: {},
        },
        task2: {
          componentRef: { name: "component2" },
          arguments: {},
        },
        task3: {
          componentRef: { name: "component3" },
          arguments: {},
        },
      });

      if (!isGraphImplementation(spec.implementation)) {
        return;
      }

      const selectedNodes = [
        createTaskNode("node-1", "task1"),
        createTaskNode("node-2", "task2"),
      ];

      const mockSubgraphTask: TaskSpec = {
        componentRef: {
          name: "MySubgraph",
          spec: {
            name: "MySubgraph",
            description: "Subgraph",
            implementation: {
              graph: { tasks: {} },
            },
          },
        },
        arguments: {},
      };

      vi.mocked(createSubgraphFromNodes).mockResolvedValue({
        subgraphTask: mockSubgraphTask,
        connectionMappings: [],
      });

      const specWithNewTask = createGraphSpec({
        task3: spec.implementation.graph!.tasks.task3,
        subgraph1: mockSubgraphTask,
      });

      vi.mocked(addTask).mockReturnValue({
        spec: specWithNewTask,
        taskId: "subgraph1",
      });

      vi.mocked(updateDownstreamSubgraphConnections).mockReturnValue(
        specWithNewTask,
      );

      await handleGroupNodes(
        selectedNodes,
        spec,
        "MySubgraph",
        onSuccess,
        onError,
      );

      expect(removeNode).toHaveBeenCalledTimes(2);
      expect(removeNode).toHaveBeenNthCalledWith(
        1,
        selectedNodes[0],
        expect.any(Object),
      );
      expect(removeNode).toHaveBeenNthCalledWith(
        2,
        selectedNodes[1],
        expect.any(Object),
      );
    });
  });

  describe("connection mappings", () => {
    it("should update connection mappings with actual subgraph task ID", async () => {
      const spec = createGraphSpec({
        task1: {
          componentRef: { name: "component1" },
          arguments: {},
        },
        externalTask: {
          componentRef: { name: "external" },
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

      const mockSubgraphTask: TaskSpec = {
        componentRef: {
          name: "MySubgraph",
          spec: {
            name: "MySubgraph",
            description: "Subgraph",
            implementation: {
              graph: { tasks: {} },
            },
          },
        },
        arguments: {},
      };

      const connectionMappings = [
        {
          originalTaskId: "task1",
          originalOutputName: "result",
          newTaskId: "PLACEHOLDER_SUBGRAPH_ID",
          newOutputName: "output1",
          targetTaskId: "externalTask",
          targetInputName: "input1",
        },
      ];

      vi.mocked(createSubgraphFromNodes).mockResolvedValue({
        subgraphTask: mockSubgraphTask,
        connectionMappings,
      });

      vi.mocked(addTask).mockReturnValue({
        spec: createGraphSpec({ subgraph1: mockSubgraphTask }),
        taskId: "subgraph1",
      });

      vi.mocked(updateDownstreamSubgraphConnections).mockReturnValue(
        createGraphSpec({ subgraph1: mockSubgraphTask }),
      );

      await handleGroupNodes(
        selectedNodes,
        spec,
        "MySubgraph",
        onSuccess,
        onError,
      );

      expect(updateDownstreamSubgraphConnections).toHaveBeenCalledWith(
        expect.any(Object),
        [
          {
            originalTaskId: "task1",
            originalOutputName: "result",
            newTaskId: "subgraph1", // Should be updated from placeholder
            newOutputName: "output1",
            targetTaskId: "externalTask",
            targetInputName: "input1",
          },
        ],
      );
    });

    it("should handle multiple connection mappings", async () => {
      const spec = createGraphSpec({
        task1: {
          componentRef: { name: "component1" },
          arguments: {},
        },
        task2: {
          componentRef: { name: "component2" },
          arguments: {},
        },
        externalTask1: {
          componentRef: { name: "external1" },
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
        externalTask2: {
          componentRef: { name: "external2" },
          arguments: {
            input1: {
              taskOutput: {
                taskId: "task2",
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

      const mockSubgraphTask: TaskSpec = {
        componentRef: {
          name: "MySubgraph",
          spec: {
            name: "MySubgraph",
            description: "Subgraph",
            implementation: {
              graph: { tasks: {} },
            },
          },
        },
        arguments: {},
      };

      const connectionMappings = [
        {
          originalTaskId: "task1",
          originalOutputName: "result",
          newTaskId: "PLACEHOLDER_SUBGRAPH_ID",
          newOutputName: "output1",
          targetTaskId: "externalTask1",
          targetInputName: "input1",
        },
        {
          originalTaskId: "task2",
          originalOutputName: "result",
          newTaskId: "PLACEHOLDER_SUBGRAPH_ID",
          newOutputName: "output2",
          targetTaskId: "externalTask2",
          targetInputName: "input1",
        },
      ];

      vi.mocked(createSubgraphFromNodes).mockResolvedValue({
        subgraphTask: mockSubgraphTask,
        connectionMappings,
      });

      vi.mocked(addTask).mockReturnValue({
        spec: createGraphSpec({ subgraph1: mockSubgraphTask }),
        taskId: "subgraph1",
      });

      vi.mocked(updateDownstreamSubgraphConnections).mockReturnValue(
        createGraphSpec({ subgraph1: mockSubgraphTask }),
      );

      await handleGroupNodes(
        selectedNodes,
        spec,
        "MySubgraph",
        onSuccess,
        onError,
      );

      expect(updateDownstreamSubgraphConnections).toHaveBeenCalledWith(
        expect.any(Object),
        expect.arrayContaining([
          expect.objectContaining({ newTaskId: "subgraph1" }),
          expect.objectContaining({ newTaskId: "subgraph1" }),
        ]),
      );
    });
  });

  describe("error handling", () => {
    it("should call onError when createSubgraphFromNodes fails", async () => {
      const spec = createGraphSpec({
        task1: {
          componentRef: { name: "component1" },
          arguments: {},
        },
      });

      const selectedNodes = [createTaskNode("node-1", "task1")];

      const error = new Error("Failed to create subgraph");
      vi.mocked(createSubgraphFromNodes).mockRejectedValue(error);

      await handleGroupNodes(
        selectedNodes,
        spec,
        "MySubgraph",
        onSuccess,
        onError,
      );

      expect(onError).toHaveBeenCalledWith(error);
      expect(onSuccess).not.toHaveBeenCalled();
    });

    it("should call onError when addTask returns undefined taskId", async () => {
      const spec = createGraphSpec({
        task1: {
          componentRef: { name: "component1" },
          arguments: {},
        },
      });

      const selectedNodes = [createTaskNode("node-1", "task1")];

      const mockSubgraphTask: TaskSpec = {
        componentRef: {
          name: "MySubgraph",
          spec: {
            name: "MySubgraph",
            description: "Subgraph",
            implementation: {
              graph: { tasks: {} },
            },
          },
        },
        arguments: {},
      };

      vi.mocked(createSubgraphFromNodes).mockResolvedValue({
        subgraphTask: mockSubgraphTask,
        connectionMappings: [],
      });

      vi.mocked(addTask).mockReturnValue({
        spec: createGraphSpec({ subgraph1: mockSubgraphTask }),
        taskId: undefined, // Simulating error case
      });

      await handleGroupNodes(
        selectedNodes,
        spec,
        "MySubgraph",
        onSuccess,
        onError,
      );

      expect(onError).toHaveBeenCalledWith(
        new Error("Subgraph Task ID is undefined."),
      );
      expect(onSuccess).not.toHaveBeenCalled();
    });

    it("should call onError when updateDownstreamSubgraphConnections throws", async () => {
      const spec = createGraphSpec({
        task1: {
          componentRef: { name: "component1" },
          arguments: {},
        },
      });

      const selectedNodes = [createTaskNode("node-1", "task1")];

      const mockSubgraphTask: TaskSpec = {
        componentRef: {
          name: "MySubgraph",
          spec: {
            name: "MySubgraph",
            description: "Subgraph",
            implementation: {
              graph: { tasks: {} },
            },
          },
        },
        arguments: {},
      };

      vi.mocked(createSubgraphFromNodes).mockResolvedValue({
        subgraphTask: mockSubgraphTask,
        connectionMappings: [],
      });

      vi.mocked(addTask).mockReturnValue({
        spec: createGraphSpec({ subgraph1: mockSubgraphTask }),
        taskId: "subgraph1",
      });

      const error = new Error("Failed to update connections");
      vi.mocked(updateDownstreamSubgraphConnections).mockImplementation(() => {
        throw error;
      });

      await handleGroupNodes(
        selectedNodes,
        spec,
        "MySubgraph",
        onSuccess,
        onError,
      );

      expect(onError).toHaveBeenCalledWith(error);
      expect(onSuccess).not.toHaveBeenCalled();
    });

    it("should call onError when removeNode throws", async () => {
      const spec = createGraphSpec({
        task1: {
          componentRef: { name: "component1" },
          arguments: {},
        },
      });

      const selectedNodes = [createTaskNode("node-1", "task1")];

      const mockSubgraphTask: TaskSpec = {
        componentRef: {
          name: "MySubgraph",
          spec: {
            name: "MySubgraph",
            description: "Subgraph",
            implementation: {
              graph: { tasks: {} },
            },
          },
        },
        arguments: {},
      };

      vi.mocked(createSubgraphFromNodes).mockResolvedValue({
        subgraphTask: mockSubgraphTask,
        connectionMappings: [],
      });

      vi.mocked(addTask).mockReturnValue({
        spec: createGraphSpec({ subgraph1: mockSubgraphTask }),
        taskId: "subgraph1",
      });

      vi.mocked(updateDownstreamSubgraphConnections).mockReturnValue(
        createGraphSpec({ subgraph1: mockSubgraphTask }),
      );

      const error = new Error("Failed to remove node");
      vi.mocked(removeNode).mockImplementation(() => {
        throw error;
      });

      await handleGroupNodes(
        selectedNodes,
        spec,
        "MySubgraph",
        onSuccess,
        onError,
      );

      expect(onError).toHaveBeenCalledWith(error);
      expect(onSuccess).not.toHaveBeenCalled();
    });
  });

  describe("non-graph implementation", () => {
    it("should do nothing for non-graph implementation", async () => {
      const spec: ComponentSpec = {
        name: "test-component",
        description: "Test component",
        implementation: {
          container: {
            image: "test:latest",
          },
        },
      };

      const selectedNodes = [createTaskNode("node-1", "task1")];

      await handleGroupNodes(
        selectedNodes,
        spec,
        "MySubgraph",
        onSuccess,
        onError,
      );

      expect(createSubgraphFromNodes).not.toHaveBeenCalled();
      expect(onSuccess).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    });
  });

  describe("edge cases", () => {
    it("should handle empty selection", async () => {
      const spec = createGraphSpec({
        task1: {
          componentRef: { name: "component1" },
          arguments: {},
        },
      });

      const selectedNodes: Node[] = [];

      const mockSubgraphTask: TaskSpec = {
        componentRef: {
          name: "MySubgraph",
          spec: {
            name: "MySubgraph",
            description: "Subgraph",
            implementation: {
              graph: { tasks: {} },
            },
          },
        },
        arguments: {},
      };

      vi.mocked(createSubgraphFromNodes).mockResolvedValue({
        subgraphTask: mockSubgraphTask,
        connectionMappings: [],
      });

      vi.mocked(addTask).mockReturnValue({
        spec: createGraphSpec({ subgraph1: mockSubgraphTask }),
        taskId: "subgraph1",
      });

      vi.mocked(updateDownstreamSubgraphConnections).mockReturnValue(
        createGraphSpec({ subgraph1: mockSubgraphTask }),
      );

      await handleGroupNodes(
        selectedNodes,
        spec,
        "MySubgraph",
        onSuccess,
        onError,
      );

      expect(removeNode).not.toHaveBeenCalled();
      expect(onSuccess).toHaveBeenCalled();
    });

    it("should handle subgraph with no connection mappings", async () => {
      const spec = createGraphSpec({
        task1: {
          componentRef: { name: "component1" },
          arguments: {},
        },
      });

      const selectedNodes = [createTaskNode("node-1", "task1")];

      const mockSubgraphTask: TaskSpec = {
        componentRef: {
          name: "MySubgraph",
          spec: {
            name: "MySubgraph",
            description: "Subgraph",
            implementation: {
              graph: { tasks: {} },
            },
          },
        },
        arguments: {},
      };

      vi.mocked(createSubgraphFromNodes).mockResolvedValue({
        subgraphTask: mockSubgraphTask,
        connectionMappings: [], // No external connections
      });

      vi.mocked(addTask).mockReturnValue({
        spec: createGraphSpec({ subgraph1: mockSubgraphTask }),
        taskId: "subgraph1",
      });

      vi.mocked(updateDownstreamSubgraphConnections).mockReturnValue(
        createGraphSpec({ subgraph1: mockSubgraphTask }),
      );

      await handleGroupNodes(
        selectedNodes,
        spec,
        "MySubgraph",
        onSuccess,
        onError,
      );

      expect(updateDownstreamSubgraphConnections).toHaveBeenCalledWith(
        expect.any(Object),
        [],
      );
      expect(onSuccess).toHaveBeenCalled();
    });
  });
});
