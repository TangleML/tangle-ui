import { beforeEach, describe, expect, it, vi } from "vitest";

import { Task } from "../../entities/task";
import { indexManager, resetIndexManager } from "../../indexes/indexManager";

describe("@indexed decorator", () => {
  beforeEach(() => resetIndexManager());

  it("indexes entity on first assignment", () => {
    const task = new Task("task_1", { name: "MyTask", componentRef: {} });

    expect(indexManager.findOne<Task>("task", "$id", "task_1")).toBe(task);
    expect(indexManager.findOne<Task>("task", "name", "MyTask")).toBe(task);
  });

  it("reindexes on value change", () => {
    const task = new Task("task_1", { name: "OldName", componentRef: {} });

    task.name = "NewName";

    expect(
      indexManager.findOne<Task>("task", "name", "OldName"),
    ).toBeUndefined();
    expect(indexManager.findOne<Task>("task", "name", "NewName")).toBe(task);
  });

  it("emits change event on indexed field change", () => {
    const task = new Task("task_1", { name: "MyTask", componentRef: {} });
    const listener = vi.fn();
    task.subscribe("changed.self.*", listener);

    task.name = "NewName";

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        field: "name",
        value: "NewName",
        oldValue: "MyTask",
      }),
    );
  });

  it("does not emit or reindex when value unchanged", () => {
    const task = new Task("task_1", { name: "Same", componentRef: {} });
    const listener = vi.fn();
    task.subscribe("changed.self.*", listener);

    task.name = "Same";

    expect(listener).not.toHaveBeenCalled();
    expect(indexManager.findOne<Task>("task", "name", "Same")).toBe(task);
  });

  it("multiple entities indexed correctly", () => {
    const task1 = new Task("task_1", { name: "Task1", componentRef: {} });
    const task2 = new Task("task_2", { name: "Task2", componentRef: {} });

    expect(indexManager.findOne<Task>("task", "$id", "task_1")).toBe(task1);
    expect(indexManager.findOne<Task>("task", "$id", "task_2")).toBe(task2);
    expect(indexManager.findOne<Task>("task", "name", "Task1")).toBe(task1);
    expect(indexManager.findOne<Task>("task", "name", "Task2")).toBe(task2);
  });

  it("handles entities with same name value", () => {
    const task1 = new Task("task_1", { name: "SameName", componentRef: {} });
    const task2 = new Task("task_2", { name: "SameName", componentRef: {} });

    const found = indexManager.find<Task>("task", "name", "SameName");
    expect(found).toHaveLength(2);
    expect(found).toContain(task1);
    expect(found).toContain(task2);
  });
});

describe("@observable decorator", () => {
  beforeEach(() => resetIndexManager());

  it("emits change event on non-indexed field change", () => {
    const task = new Task("task_1", {
      name: "Task",
      componentRef: { name: "OldRef" },
    });
    const listener = vi.fn();
    task.subscribe("changed.self.*", listener);

    task.componentRef = { name: "NewRef" };

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        field: "componentRef",
        value: { name: "NewRef" },
        oldValue: { name: "OldRef" },
      }),
    );
  });

  it("does not emit when value unchanged (same reference)", () => {
    const ref = { name: "Ref" };
    const task = new Task("task_1", { name: "Task", componentRef: ref });
    const listener = vi.fn();
    task.subscribe("changed.self.*", listener);

    task.componentRef = ref;

    expect(listener).not.toHaveBeenCalled();
  });
});
