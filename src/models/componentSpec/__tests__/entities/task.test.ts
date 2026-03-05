import { describe, expect, it } from "vitest";

import { Task } from "../../entities/task";

describe("Task", () => {
  it("creates with required properties", () => {
    const task = new Task({
      $id: "task_1",
      name: "ProcessData",
      componentRef: { name: "DataProcessor" },
    });

    expect(task.$id).toBe("task_1");
    expect(task.name).toBe("ProcessData");
    expect(task.componentRef).toEqual({ name: "DataProcessor" });
  });

  it("has empty annotations and arguments by default", () => {
    const task = new Task({
      $id: "task_1",
      name: "T",
      componentRef: {},
    });

    expect(task.annotations.length).toBe(0);
    expect(task.arguments.length).toBe(0);
  });

  it("annotations.add adds to annotations", () => {
    const task = new Task({
      $id: "task_1",
      name: "T",
      componentRef: {},
    });

    task.annotations.add({ key: "foo", value: "bar" });

    expect(task.annotations.length).toBe(1);
    expect(task.annotations.items[0]).toEqual({ key: "foo", value: "bar" });
  });

  it("addArgument adds to arguments", () => {
    const task = new Task({
      $id: "task_1",
      name: "T",
      componentRef: {},
    });

    task.addArgument({ name: "input", value: "test" });

    expect(task.arguments.length).toBe(1);
    expect(task.arguments[0]).toEqual({ name: "input", value: "test" });
  });

  it("can set isEnabled predicate", () => {
    const task = new Task({
      $id: "task_1",
      name: "T",
      componentRef: {},
      isEnabled: { "==": { op1: "a", op2: "b" } },
    });

    expect(task.isEnabled).toEqual({ "==": { op1: "a", op2: "b" } });
  });

  it("setName updates name", () => {
    const task = new Task({
      $id: "task_1",
      name: "OldName",
      componentRef: {},
    });

    task.setName("NewName");

    expect(task.name).toBe("NewName");
  });

  it("setComponentRef updates componentRef", () => {
    const task = new Task({
      $id: "task_1",
      name: "T",
      componentRef: { name: "A" },
    });

    task.setComponentRef({ name: "B" });

    expect(task.componentRef).toEqual({ name: "B" });
  });

  it("has undefined executionOptions by default", () => {
    const task = new Task({
      $id: "task_1",
      name: "T",
      componentRef: {},
    });

    expect(task.executionOptions).toBeUndefined();
  });

  it("can be created with executionOptions", () => {
    const task = new Task({
      $id: "task_1",
      name: "T",
      componentRef: {},
      executionOptions: {
        cachingStrategy: { maxCacheStaleness: "P0D" },
      },
    });

    expect(task.executionOptions).toEqual({
      cachingStrategy: { maxCacheStaleness: "P0D" },
    });
  });

  it("setCacheStaleness sets cachingStrategy", () => {
    const task = new Task({
      $id: "task_1",
      name: "T",
      componentRef: {},
    });

    task.setCacheStaleness("P0D");

    expect(task.executionOptions).toEqual({
      cachingStrategy: { maxCacheStaleness: "P0D" },
    });
  });

  it("setCacheStaleness clears executionOptions when no other options remain", () => {
    const task = new Task({
      $id: "task_1",
      name: "T",
      componentRef: {},
      executionOptions: {
        cachingStrategy: { maxCacheStaleness: "P0D" },
      },
    });

    task.setCacheStaleness(undefined);

    expect(task.executionOptions).toBeUndefined();
  });

  it("setCacheStaleness preserves retryStrategy when clearing cache", () => {
    const task = new Task({
      $id: "task_1",
      name: "T",
      componentRef: {},
      executionOptions: {
        retryStrategy: { maxRetries: 3 },
        cachingStrategy: { maxCacheStaleness: "P0D" },
      },
    });

    task.setCacheStaleness(undefined);

    expect(task.executionOptions).toEqual({
      retryStrategy: { maxRetries: 3 },
    });
  });
});
