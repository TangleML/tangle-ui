import { beforeEach, describe, expect, it, vi } from "vitest";

import { Task } from "../../entities/task";
import { resetIndexManager } from "../../indexes/indexManager";

describe("Task", () => {
  beforeEach(() => resetIndexManager());

  it("creates with required properties", () => {
    const task = new Task("task_1", {
      name: "ProcessData",
      componentRef: { name: "DataProcessor" },
    });

    expect(task.$id).toBe("task_1");
    expect(task.name).toBe("ProcessData");
    expect(task.componentRef).toEqual({ name: "DataProcessor" });
  });

  it("has empty annotations and arguments by default", () => {
    const task = new Task("task_1", { name: "T", componentRef: {} });

    expect(task.annotations.length).toBe(0);
    expect(task.arguments.length).toBe(0);
  });

  it("annotations are reactive", () => {
    const task = new Task("task_1", { name: "T", componentRef: {} });
    const listener = vi.fn();
    task.annotations.subscribe("changed.self.*", listener);

    task.annotations.add({ key: "foo", value: "bar" });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("arguments are reactive", () => {
    const task = new Task("task_1", { name: "T", componentRef: {} });
    const listener = vi.fn();
    task.arguments.subscribe("changed.self.*", listener);

    task.arguments.add({ name: "input", value: "test" });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('$namespace is "task"', () => {
    const task = new Task("task_1", { name: "T", componentRef: {} });
    expect(task.$namespace).toBe("task");
  });

  it("can set isEnabled predicate", () => {
    const task = new Task("task_1", {
      name: "T",
      componentRef: {},
      isEnabled: { "==": { op1: "a", op2: "b" } },
    });

    expect(task.isEnabled).toEqual({ "==": { op1: "a", op2: "b" } });
  });

  it("emits change when name changes", () => {
    const task = new Task("task_1", { name: "OldName", componentRef: {} });
    const listener = vi.fn();
    task.subscribe("changed.self.*", listener);

    task.name = "NewName";

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        field: "name",
        value: "NewName",
        oldValue: "OldName",
      }),
    );
  });

  it("emits change when componentRef changes", () => {
    const task = new Task("task_1", { name: "T", componentRef: { name: "A" } });
    const listener = vi.fn();
    task.subscribe("changed.self.*", listener);

    task.componentRef = { name: "B" };

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        field: "componentRef",
        value: { name: "B" },
        oldValue: { name: "A" },
      }),
    );
  });
});
