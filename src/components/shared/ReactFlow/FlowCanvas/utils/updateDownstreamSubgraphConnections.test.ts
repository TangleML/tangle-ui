import { describe, expect, it } from "vitest";

import {
  type ArgumentType,
  type ComponentSpec,
  isGraphImplementation,
  type TaskOutputArgument,
  type TaskSpec,
} from "@/utils/componentSpec";

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

  describe("Scenario 1: TaskOutput connected to TaskInput", () => {
    it("should redirect task arguments to replacement task when output exists", () => {
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

      const result = updateDownstreamSubgraphConnections(
        componentSpec,
        ["original1", "original2"],
        "replacement1",
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

    it("should remove task arguments when replacement task lacks matching output", () => {
      const originalTask = createMockTask("OriginalTask", {}, [
        { name: "result", type: "string" },
      ]);
      const replacementTask = createMockTask("ReplacementTask", {}, [
        { name: "different_output", type: "string" },
      ]);
      const externalTask = createMockTask("ExternalTask", {
        input1: {
          taskOutput: {
            taskId: "original1",
            outputName: "result",
            type: "string",
          },
        },
        keepMe: "static_value",
      });

      const componentSpec = createMockComponentSpec({
        original1: originalTask,
        replacement1: replacementTask,
        external1: externalTask,
      });

      const result = updateDownstreamSubgraphConnections(
        componentSpec,
        ["original1"],
        "replacement1",
      );

      if (!isGraphImplementation(result.implementation)) {
        throw new Error("Expected graph implementation");
      }

      const updatedExternalTask = result.implementation.graph.tasks.external1;

      expect(updatedExternalTask.arguments?.input1).toBeUndefined();
      expect(updatedExternalTask.arguments?.keepMe).toBe("static_value");
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

      const result = updateDownstreamSubgraphConnections(
        componentSpec,
        ["original1"],
        "replacement1",
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

      // Unrelated connection should remain unchanged
      expect(updatedExternalTask.arguments?.input2).toEqual({
        taskOutput: {
          taskId: "unrelated1",
          outputName: "other",
          type: "string",
        },
      });
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

      const result = updateDownstreamSubgraphConnections(
        componentSpec,
        ["original1", "original2"],
        "replacement1",
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

    it("should remove graph output values when replacement task lacks matching output", () => {
      const originalTask = createMockTask("OriginalTask", {}, [
        { name: "result", type: "string" },
      ]);
      const replacementTask = createMockTask("ReplacementTask", {}, [
        { name: "different_output", type: "string" },
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

      const result = updateDownstreamSubgraphConnections(
        componentSpec,
        ["original1"],
        "replacement1",
      );

      if (!isGraphImplementation(result.implementation)) {
        throw new Error("Expected graph implementation");
      }

      expect(result.implementation.graph.outputValues?.output1).toBeUndefined();
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
    it("should handle empty originalTaskIds array", () => {
      const componentSpec = createMockComponentSpec({
        task1: createMockTask("Task1"),
      });

      const result = updateDownstreamSubgraphConnections(
        componentSpec,
        [],
        "replacement1",
      );

      expect(result).toEqual(componentSpec);
    });

    it("should handle missing replacement task", () => {
      const originalTask = createMockTask("OriginalTask", {}, [
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
        external1: externalTask,
      });

      const result = updateDownstreamSubgraphConnections(
        componentSpec,
        ["original1"],
        "nonexistent_replacement",
      );

      if (!isGraphImplementation(result.implementation)) {
        throw new Error("Expected graph implementation");
      }

      // Should remove the connection since replacement task doesn't exist
      const updatedExternalTask = result.implementation.graph.tasks.external1;
      expect(updatedExternalTask.arguments?.input1).toBeUndefined();
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

      const result = updateDownstreamSubgraphConnections(
        componentSpec,
        ["task1"],
        "replacement1",
      );

      expect(result).toEqual(componentSpec);
    });

    it("should handle tasks without arguments", () => {
      const originalTask = createMockTask("OriginalTask", {}, [
        { name: "result", type: "string" },
      ]);
      const replacementTask = createMockTask("ReplacementTask", {}, [
        { name: "result", type: "string" },
      ]);
      const taskWithoutArgs = createMockTask("TaskWithoutArgs");

      const componentSpec = createMockComponentSpec({
        original1: originalTask,
        replacement1: replacementTask,
        no_args: taskWithoutArgs,
      });

      const result = updateDownstreamSubgraphConnections(
        componentSpec,
        ["original1"],
        "replacement1",
      );

      if (!isGraphImplementation(result.implementation)) {
        throw new Error("Expected graph implementation");
      }

      // Should not throw and leave task unchanged
      expect(result.implementation.graph.tasks.no_args).toEqual(
        taskWithoutArgs,
      );
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

      updateDownstreamSubgraphConnections(
        componentSpec,
        ["original1"],
        "replacement1",
      );

      // Original should be unchanged
      expect(
        componentSpec.implementation.graph.tasks.external1.arguments?.input1,
      ).toEqual(originalTaskInput);
    });
  });
});
