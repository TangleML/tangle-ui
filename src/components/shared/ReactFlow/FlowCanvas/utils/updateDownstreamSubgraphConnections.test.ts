import { describe, expect, it } from "vitest";

import {
  type ArgumentType,
  type ComponentSpec,
  isGraphImplementation,
  type TaskOutputArgument,
  type TaskSpec,
} from "@/utils/componentSpec";
import {
  type ConnectionMapping,
  GRAPH_OUTPUT,
  PLACEHOLDER_SUBGRAPH_ID,
} from "@/utils/nodes/createSubgraphFromNodes";

import { updateDownstreamSubgraphConnections } from "./updateDownstreamSubgraphConnections";

describe("updateDownstreamSubgraphConnections", () => {
  const createMockComponentSpec = (
    tasks: Record<string, TaskSpec>,
    outputValues?: Record<string, TaskOutputArgument>,
  ): ComponentSpec => ({
    name: "Test Component",
    implementation: {
      graph: {
        tasks,
        ...(outputValues && { outputValues }),
      },
    },
  });

  const createMockTask = (
    name: string,
    arguments_?: Record<string, ArgumentType>,
    outputs: Array<{ name: string; type?: string }> = [],
  ): TaskSpec => ({
    componentRef: {
      name,
      spec: {
        name,
        outputs,
        implementation: { container: { image: "test" } },
      },
    },
    ...(arguments_ && { arguments: arguments_ }),
  });

  const createConnectionMapping = (
    originalTaskId: string,
    originalOutputName: string,
    newTaskId: string,
    newOutputName: string,
    targetTaskId: string,
    targetInputName: string,
  ): ConnectionMapping => ({
    originalTaskId,
    originalOutputName,
    newTaskId,
    newOutputName,
    targetTaskId,
    targetInputName,
  });

  describe("Scenario 1: TaskOutput connected to TaskInput", () => {
    it("should redirect task arguments to replacement task using connection mappings", () => {
      const originalTask1 = createMockTask("OriginalTask1", {}, [
        { name: "result", type: "string" },
      ]);
      const originalTask2 = createMockTask("OriginalTask2", {}, [
        { name: "data", type: "string" },
      ]);
      const replacementTask = createMockTask("ReplacementTask", {}, [
        { name: "result", type: "string" },
        { name: "data", type: "string" },
      ]);
      const externalTask = createMockTask("ExternalTask", {
        input1: {
          taskOutput: {
            taskId: "original1",
            outputName: "result",
            type: "string",
          },
        },
        input2: {
          taskOutput: {
            taskId: "original2",
            outputName: "data",
            type: "string",
          },
        },
      });

      const componentSpec = createMockComponentSpec({
        original1: originalTask1,
        original2: originalTask2,
        replacement1: replacementTask,
        external1: externalTask,
      });

      const connectionMappings: ConnectionMapping[] = [
        createConnectionMapping(
          "original1",
          "result",
          "replacement1",
          "result",
          "external1",
          "input1",
        ),
        createConnectionMapping(
          "original2",
          "data",
          "replacement1",
          "data",
          "external1",
          "input2",
        ),
      ];

      const result = updateDownstreamSubgraphConnections(
        componentSpec,
        connectionMappings,
      );

      if (!isGraphImplementation(result.implementation)) {
        throw new Error("Expected graph implementation");
      }

      const updatedExternalTask = result.implementation.graph.tasks.external1;

      expect(updatedExternalTask.arguments?.input1).toEqual({
        taskOutput: {
          taskId: "replacement1",
          outputName: "result",
          type: "string",
        },
      });

      expect(updatedExternalTask.arguments?.input2).toEqual({
        taskOutput: {
          taskId: "replacement1",
          outputName: "data",
          type: "string",
        },
      });
    });

    it("should handle output name collisions correctly", () => {
      const originalTask1 = createMockTask("OriginalTask1", {}, [
        { name: "result", type: "string" },
      ]);
      const originalTask2 = createMockTask("OriginalTask2", {}, [
        { name: "result", type: "string" },
      ]);
      const replacementTask = createMockTask("ReplacementTask", {}, [
        { name: "result", type: "string" },
        { name: "result 2", type: "string" },
      ]);
      const externalTask1 = createMockTask("ExternalTask1", {
        input1: {
          taskOutput: {
            taskId: "original1",
            outputName: "result",
            type: "string",
          },
        },
      });
      const externalTask2 = createMockTask("ExternalTask2", {
        input1: {
          taskOutput: {
            taskId: "original2",
            outputName: "result",
            type: "string",
          },
        },
      });

      const componentSpec = createMockComponentSpec({
        original1: originalTask1,
        original2: originalTask2,
        replacement1: replacementTask,
        external1: externalTask1,
        external2: externalTask2,
      });

      const connectionMappings: ConnectionMapping[] = [
        createConnectionMapping(
          "original1",
          "result",
          "replacement1",
          "result",
          "external1",
          "input1",
        ),
        createConnectionMapping(
          "original2",
          "result",
          "replacement1",
          "result_2",
          "external2",
          "input1",
        ),
      ];

      const result = updateDownstreamSubgraphConnections(
        componentSpec,
        connectionMappings,
      );

      if (!isGraphImplementation(result.implementation)) {
        throw new Error("Expected graph implementation");
      }

      const updatedExternalTask1 = result.implementation.graph.tasks.external1;
      const updatedExternalTask2 = result.implementation.graph.tasks.external2;

      expect(updatedExternalTask1.arguments?.input1).toEqual({
        taskOutput: {
          taskId: "replacement1",
          outputName: "result",
          type: "string",
        },
      });

      expect(updatedExternalTask2.arguments?.input1).toEqual({
        taskOutput: {
          taskId: "replacement1",
          outputName: "result_2",
          type: "string",
        },
      });
    });

    it("should leave unrelated connections unchanged", () => {
      const originalTask = createMockTask("OriginalTask", {}, [
        { name: "result", type: "string" },
      ]);
      const replacementTask = createMockTask("ReplacementTask", {}, [
        { name: "result", type: "string" },
      ]);
      const unrelatedTask = createMockTask("UnrelatedTask", {}, [
        { name: "other", type: "string" },
      ]);
      const externalTask = createMockTask("ExternalTask", {
        input1: {
          taskOutput: {
            taskId: "original1",
            outputName: "result",
            type: "string",
          },
        },
        input2: {
          taskOutput: {
            taskId: "unrelated1",
            outputName: "other",
            type: "string",
          },
        },
      });

      const componentSpec = createMockComponentSpec({
        original1: originalTask,
        replacement1: replacementTask,
        unrelated1: unrelatedTask,
        external1: externalTask,
      });

      const connectionMappings: ConnectionMapping[] = [
        createConnectionMapping(
          "original1",
          "result",
          "replacement1",
          "result",
          "external1",
          "input1",
        ),
      ];

      const result = updateDownstreamSubgraphConnections(
        componentSpec,
        connectionMappings,
      );

      if (!isGraphImplementation(result.implementation)) {
        throw new Error("Expected graph implementation");
      }

      const updatedExternalTask = result.implementation.graph.tasks.external1;

      expect(updatedExternalTask.arguments?.input1).toEqual({
        taskOutput: {
          taskId: "replacement1",
          outputName: "result",
          type: "string",
        },
      });

      expect(updatedExternalTask.arguments?.input2).toEqual({
        taskOutput: {
          taskId: "unrelated1",
          outputName: "other",
          type: "string",
        },
      });
    });

    it("should throw error when connection mapping contains placeholder", () => {
      const componentSpec = createMockComponentSpec({
        task1: createMockTask("Task1"),
      });

      const connectionMappings: ConnectionMapping[] = [
        createConnectionMapping(
          "original1",
          "result",
          PLACEHOLDER_SUBGRAPH_ID,
          "result",
          "external1",
          "input1",
        ),
      ];

      expect(() => {
        updateDownstreamSubgraphConnections(componentSpec, connectionMappings);
      }).toThrow("ConnectionMapping contains placeholder newTaskId");
    });
  });

  describe("Scenario 2: TaskOutput connected to GraphOutput", () => {
    it("should redirect graph output values to replacement task", () => {
      const originalTask1 = createMockTask("OriginalTask1", {}, [
        { name: "final_result", type: "string" },
      ]);
      const originalTask2 = createMockTask("OriginalTask2", {}, [
        { name: "summary", type: "string" },
      ]);
      const replacementTask = createMockTask("ReplacementTask", {}, [
        { name: "final result", type: "string" },
        { name: "summary", type: "string" },
      ]);

      const componentSpec = createMockComponentSpec(
        {
          original1: originalTask1,
          original2: originalTask2,
          replacement1: replacementTask,
        },
        {
          output1: {
            taskOutput: {
              taskId: "original1",
              outputName: "final_result",
              type: "string",
            },
          },
          output2: {
            taskOutput: {
              taskId: "original2",
              outputName: "summary",
              type: "string",
            },
          },
        },
      );

      const connectionMappings: ConnectionMapping[] = [
        createConnectionMapping(
          "original1",
          "final_result",
          "replacement1",
          "final_result",
          GRAPH_OUTPUT,
          "output1",
        ),
        createConnectionMapping(
          "original2",
          "summary",
          "replacement1",
          "summary",
          GRAPH_OUTPUT,
          "output2",
        ),
      ];

      const result = updateDownstreamSubgraphConnections(
        componentSpec,
        connectionMappings,
      );

      if (!isGraphImplementation(result.implementation)) {
        throw new Error("Expected graph implementation");
      }

      expect(result.implementation.graph.outputValues?.output1).toEqual({
        taskOutput: {
          taskId: "replacement1",
          outputName: "final_result",
          type: "string",
        },
      });

      expect(result.implementation.graph.outputValues?.output2).toEqual({
        taskOutput: {
          taskId: "replacement1",
          outputName: "summary",
          type: "string",
        },
      });
    });

    it("should leave unrelated graph outputs unchanged", () => {
      const originalTask = createMockTask("OriginalTask", {}, [
        { name: "result", type: "string" },
      ]);
      const replacementTask = createMockTask("ReplacementTask", {}, [
        { name: "result", type: "string" },
      ]);

      const componentSpec = createMockComponentSpec(
        {
          original1: originalTask,
          replacement1: replacementTask,
        },
        {
          output1: {
            taskOutput: {
              taskId: "original1",
              outputName: "result",
              type: "string",
            },
          },
          keepOutput: {
            taskOutput: {
              taskId: "other_task",
              outputName: "other_result",
              type: "string",
            },
          },
        },
      );

      const connectionMappings: ConnectionMapping[] = [
        createConnectionMapping(
          "original1",
          "result",
          "replacement1",
          "result",
          GRAPH_OUTPUT,
          "output1",
        ),
      ];

      const result = updateDownstreamSubgraphConnections(
        componentSpec,
        connectionMappings,
      );

      if (!isGraphImplementation(result.implementation)) {
        throw new Error("Expected graph implementation");
      }

      expect(result.implementation.graph.outputValues?.output1).toEqual({
        taskOutput: {
          taskId: "replacement1",
          outputName: "result",
          type: "string",
        },
      });

      expect(result.implementation.graph.outputValues?.keepOutput).toEqual({
        taskOutput: {
          taskId: "other_task",
          outputName: "other_result",
          type: "string",
        },
      });
    });
  });

  describe("Edge cases", () => {
    it("should handle empty connection mappings array", () => {
      const componentSpec = createMockComponentSpec({
        task1: createMockTask("Task1"),
      });

      const result = updateDownstreamSubgraphConnections(componentSpec, []);

      expect(result).toEqual(componentSpec);
    });

    it("should handle non-graph implementations gracefully", () => {
      const componentSpec: ComponentSpec = {
        name: "Container Component",
        implementation: {
          container: {
            image: "test-image",
          },
        },
      };

      const connectionMappings: ConnectionMapping[] = [
        createConnectionMapping(
          "original1",
          "result",
          "replacement1",
          "result",
          "external1",
          "input1",
        ),
      ];

      const result = updateDownstreamSubgraphConnections(
        componentSpec,
        connectionMappings,
      );

      expect(result).toEqual(componentSpec);
    });

    it("should handle missing target tasks gracefully", () => {
      const originalTask = createMockTask("OriginalTask", {}, [
        { name: "result", type: "string" },
      ]);
      const replacementTask = createMockTask("ReplacementTask", {}, [
        { name: "result", type: "string" },
      ]);

      const componentSpec = createMockComponentSpec({
        original1: originalTask,
        replacement1: replacementTask,
      });

      const connectionMappings: ConnectionMapping[] = [
        createConnectionMapping(
          "original1",
          "result",
          "replacement1",
          "result",
          "nonexistent_task",
          "input1",
        ),
      ];

      const result = updateDownstreamSubgraphConnections(
        componentSpec,
        connectionMappings,
      );

      if (!isGraphImplementation(result.implementation)) {
        throw new Error("Expected graph implementation");
      }

      expect(result.implementation.graph.tasks.original1).toEqual(originalTask);
    });

    it("should handle missing target inputs gracefully", () => {
      const originalTask = createMockTask("OriginalTask", {}, [
        { name: "result", type: "string" },
      ]);
      const replacementTask = createMockTask("ReplacementTask", {}, [
        { name: "result", type: "string" },
      ]);
      const externalTask = createMockTask("ExternalTask", {
        existing_input: "some_value",
      });

      const componentSpec = createMockComponentSpec({
        original1: originalTask,
        replacement1: replacementTask,
        external1: externalTask,
      });

      const connectionMappings: ConnectionMapping[] = [
        createConnectionMapping(
          "original1",
          "result",
          "replacement1",
          "result",
          "external1",
          "nonexistent_input",
        ),
      ];

      const result = updateDownstreamSubgraphConnections(
        componentSpec,
        connectionMappings,
      );

      if (!isGraphImplementation(result.implementation)) {
        throw new Error("Expected graph implementation");
      }

      expect(result.implementation.graph.tasks.external1).toEqual(externalTask);
    });

    it("should not modify the original componentSpec", () => {
      const originalTask = createMockTask("OriginalTask", {}, [
        { name: "result", type: "string" },
      ]);
      const replacementTask = createMockTask("ReplacementTask", {}, [
        { name: "result", type: "string" },
      ]);
      const externalTask = createMockTask("ExternalTask", {
        input1: {
          taskOutput: {
            taskId: "original1",
            outputName: "result",
            type: "string",
          },
        },
      });

      const componentSpec = createMockComponentSpec({
        original1: originalTask,
        replacement1: replacementTask,
        external1: externalTask,
      });

      if (!isGraphImplementation(componentSpec.implementation)) {
        throw new Error("Expected graph implementation");
      }

      const originalTaskInput =
        componentSpec.implementation.graph.tasks.external1.arguments?.input1;

      const connectionMappings: ConnectionMapping[] = [
        createConnectionMapping(
          "original1",
          "result",
          "replacement1",
          "result",
          "external1",
          "input1",
        ),
      ];

      updateDownstreamSubgraphConnections(componentSpec, connectionMappings);

      expect(
        componentSpec.implementation.graph.tasks.external1.arguments?.input1,
      ).toEqual(originalTaskInput);
    });
  });
});
