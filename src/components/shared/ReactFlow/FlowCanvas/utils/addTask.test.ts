import type { XYPosition } from "@xyflow/react";
import { beforeEach, describe, expect, it } from "vitest";

import type { ComponentSpec, TaskSpec } from "@/utils/componentSpec";

import addTask from "./addTask";

describe("addTask", () => {
  let position: XYPosition;
  let mockComponentSpec: ComponentSpec;

  beforeEach(() => {
    position = {
      x: 50,
      y: 100,
    };

    mockComponentSpec = {
      name: "TestComponent",
      inputs: [],
      outputs: [],
      implementation: { graph: { tasks: {} } },
    };
  });

  it("should do nothing if dropped data is empty", () => {
    const result = addTask("task", null, position, mockComponentSpec);

    expect(result.spec).toStrictEqual(mockComponentSpec);
    expect(result.taskId).toBeUndefined();
  });

  it("should add a task node when task type is dropped", () => {
    const mockTaskSpec: TaskSpec = {
      componentRef: {
        spec: {
          name: "TestTask",
          implementation: { graph: { tasks: {} } },
        },
      },
      annotations: {},
    };

    const result = addTask("task", mockTaskSpec, position, mockComponentSpec);

    const newComponentSpec = result.spec as typeof mockComponentSpec & {
      implementation: { graph: { tasks: Record<string, any> } };
    };

    expect(
      Object.keys(newComponentSpec.implementation.graph.tasks).length,
    ).toBe(1);

    const taskId = result.taskId;
    expect(taskId).toBeDefined();

    if (!taskId) return;

    const task = newComponentSpec.implementation.graph.tasks[taskId];
    expect(task.annotations).toHaveProperty("editor.position");
    expect(task.annotations["editor.position"]).toBe(
      JSON.stringify({ x: 50, y: 100 }),
    );
  });

  it("should add an input node when input type is dropped", () => {
    const result = addTask("input", null, position, mockComponentSpec);

    const newComponentSpec = result.spec as typeof mockComponentSpec & {
      inputs: Array<{ name: string; annotations: Record<string, any> }>;
    };

    expect(newComponentSpec.inputs.length).toBe(1);
    expect(newComponentSpec.inputs[0].name).toBe("Input");
    expect(newComponentSpec.inputs[0].annotations).toHaveProperty(
      "editor.position",
    );
    expect(result.taskId).toBeUndefined();
  });

  it("should add an output node when output type is dropped", () => {
    const result = addTask("output", null, position, mockComponentSpec);

    const newComponentSpec = result.spec as typeof mockComponentSpec & {
      outputs: Array<{ name: string; annotations: Record<string, any> }>;
    };

    expect(newComponentSpec.outputs.length).toBe(1);
    expect(newComponentSpec.outputs[0].name).toBe("Output");
    expect(newComponentSpec.outputs[0].annotations).toHaveProperty(
      "editor.position",
    );
    expect(result.taskId).toBeUndefined();
  });

  it("should create unique names for tasks when duplicates exist", () => {
    const mockGraphSpec = {
      tasks: {
        TestTask: { componentRef: {}, annotations: {} },
      },
    };

    const newMockComponentSpec = {
      ...mockComponentSpec,
      implementation: { graph: mockGraphSpec },
    };

    const mockTaskSpec: TaskSpec = {
      componentRef: {
        spec: {
          name: "TestTask",
          implementation: { graph: { tasks: {} } },
        },
      },
      annotations: {},
    };

    const result = addTask(
      "task",
      mockTaskSpec,
      position,
      newMockComponentSpec,
    );

    const newComponentSpec = result.spec;
    const taskId = result.taskId;

    expect(taskId).toBeDefined();
    if (!taskId) return;

    const taskIds =
      "graph" in newComponentSpec.implementation &&
      newComponentSpec.implementation.graph.tasks
        ? Object.keys(newComponentSpec.implementation.graph.tasks)
        : [];
    expect(taskIds.length).toBe(2);
    expect(taskIds).toContain("TestTask 2");
  });

  it("should create unique names for inputs when duplicates exist", () => {
    const newMockComponentSpec = {
      ...mockComponentSpec,
      inputs: [{ name: "Input", annotations: {} }],
    };

    const result = addTask("input", null, position, newMockComponentSpec);

    const newComponentSpec = result.spec as typeof newMockComponentSpec & {
      inputs: Array<{ name: string; annotations: Record<string, any> }>;
    };

    expect(newComponentSpec.inputs.length).toBe(2);
    expect(newComponentSpec.inputs[1].name).toBe("Input 2");
  });

  it("should create unique names for outputs when duplicates exist", () => {
    const newMockComponentSpec = {
      ...mockComponentSpec,
      outputs: [{ name: "Output", annotations: {} }],
    };

    const result = addTask("output", null, position, newMockComponentSpec);

    const newComponentSpec = result.spec as typeof newMockComponentSpec & {
      outputs: Array<{ name: string; annotations: Record<string, any> }>;
    };

    expect(newComponentSpec.outputs.length).toBe(2);
    expect(newComponentSpec.outputs[1].name).toBe("Output 2");
  });
});
