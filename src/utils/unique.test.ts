import { describe, expect, it } from "vitest";

import type { ComponentSpec, GraphSpec } from "./componentSpec";
import {
  getUniqueInputName,
  getUniqueName,
  getUniqueOutputName,
  getUniqueTaskName,
  validateTaskName,
} from "./unique";

const specWithInputs = (names: string[]): ComponentSpec =>
  ({ inputs: names.map((name) => ({ name })) }) as ComponentSpec;

const specWithOutputs = (names: string[]): ComponentSpec =>
  ({ outputs: names.map((name) => ({ name })) }) as ComponentSpec;

const graphWithTasks = (tasks: Record<string, string | undefined>): GraphSpec =>
  ({
    tasks: Object.fromEntries(
      Object.entries(tasks).map(([id, specName]) => [
        id,
        { componentRef: { spec: specName ? { name: specName } : undefined } },
      ]),
    ),
  }) as unknown as GraphSpec;

describe("getUniqueName()", () => {
  it("returns the name unchanged when it is not taken", () => {
    expect(getUniqueName(["A", "B"], "C")).toBe("C");
  });

  it("appends an index when the name collides", () => {
    expect(getUniqueName(["Task"], "Task")).toBe("Task 2");
  });

  it("increments the index past consecutive collisions", () => {
    expect(getUniqueName(["Task", "Task 2", "Task 3"], "Task")).toBe("Task 4");
  });

  it("defaults to 'Untitled' when no name is provided", () => {
    expect(getUniqueName([])).toBe("Untitled");
    expect(getUniqueName(["Untitled"])).toBe("Untitled 2");
  });
});

describe("getUniqueInputName()", () => {
  it("defaults to 'Input' and suffixes on collision", () => {
    expect(getUniqueInputName(specWithInputs([]))).toBe("Input");
    expect(getUniqueInputName(specWithInputs(["Input"]))).toBe("Input 2");
  });

  it("respects a custom base name", () => {
    expect(getUniqueInputName(specWithInputs(["x"]), "x")).toBe("x 2");
  });
});

describe("getUniqueOutputName()", () => {
  it("defaults to 'Output' and suffixes on collision", () => {
    expect(getUniqueOutputName(specWithOutputs([]))).toBe("Output");
    expect(getUniqueOutputName(specWithOutputs(["Output"]))).toBe("Output 2");
  });
});

describe("getUniqueTaskName()", () => {
  it("defaults to 'Task' and suffixes based on existing task ids", () => {
    expect(getUniqueTaskName(graphWithTasks({}))).toBe("Task");
    expect(getUniqueTaskName(graphWithTasks({ Task: "A" }))).toBe("Task 2");
  });
});

describe("validateTaskName()", () => {
  const graph = graphWithTasks({ task_a: "Existing Task" });

  it("rejects an empty or whitespace-only name", () => {
    expect(validateTaskName("", graph)).toBe("Name cannot be empty");
    expect(validateTaskName("   ", graph)).toBe("Name cannot be empty");
  });

  it("rejects a name that duplicates an existing task display name", () => {
    expect(validateTaskName("Existing Task", graph)).toBe(
      "A task with this name already exists",
    );
  });

  it("rejects a duplicate task id only when checkId is set", () => {
    expect(validateTaskName("task_a", graph, true)).toBe(
      "A task with this id already exists",
    );
    // Without checkId the id collision is not reported (name is still free).
    expect(validateTaskName("task_a", graph, false)).toBeNull();
  });

  it("rejects names containing special characters", () => {
    expect(validateTaskName("bad$name", graph)).toBe(
      "Name cannot contain special characters",
    );
  });

  it("accepts a valid, unused name with allowed characters", () => {
    expect(validateTaskName("New_task-1", graph)).toBeNull();
  });
});
