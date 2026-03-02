import { beforeEach, describe, expect, it, vi } from "vitest";

import { ComponentSpec } from "../../entities/componentSpec";
import { Task } from "../../entities/task";
import { indexManager, resetIndexManager } from "../../indexes/indexManager";

describe("Reactivity Integration", () => {
  beforeEach(() => resetIndexManager());

  it("entity changes propagate to subscribers", () => {
    const spec = new ComponentSpec("spec_1", "Test");
    const task = new Task("task_1", { name: "T1", componentRef: {} });
    spec.tasks.add(task);

    const specListener = vi.fn();
    const taskListener = vi.fn();
    const tasksListener = vi.fn();

    spec.subscribe("changed.self.*", specListener);
    task.subscribe("changed.self.*", taskListener);
    spec.tasks.subscribe("changed.self.*", tasksListener);

    spec.name = "NewName";
    expect(specListener).toHaveBeenCalledWith(
      expect.objectContaining({ field: "name" }),
    );

    task.name = "T2";
    expect(taskListener).toHaveBeenCalledWith(
      expect.objectContaining({ field: "name" }),
    );

    const task2 = new Task("task_2", { name: "T3", componentRef: {} });
    spec.tasks.add(task2);
    expect(tasksListener).toHaveBeenCalled();
  });

  it("index stays in sync with entity changes", () => {
    const task = new Task("task_1", { name: "Original", componentRef: {} });

    expect(indexManager.findOne<Task>("task", "name", "Original")).toBe(task);

    task.name = "Changed";

    expect(
      indexManager.findOne<Task>("task", "name", "Original"),
    ).toBeUndefined();
    expect(indexManager.findOne<Task>("task", "name", "Changed")).toBe(task);
  });

  it("multiple subscriptions work independently", () => {
    const task = new Task("task_1", { name: "T", componentRef: {} });
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    const unsub1 = task.subscribe("changed.self.*", listener1);
    task.subscribe("changed.self.*", listener2);

    task.name = "A";
    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledTimes(1);

    unsub1();
    task.name = "B";
    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledTimes(2);
  });

  it("nested entity changes trigger correct subscribers", () => {
    const spec = new ComponentSpec("spec_1", "Test");
    const task = new Task("task_1", { name: "T1", componentRef: {} });
    spec.tasks.add(task);

    const specListener = vi.fn();
    const taskListener = vi.fn();
    const annotationsListener = vi.fn();

    spec.subscribe("changed.self.*", specListener);
    task.subscribe("changed.self.*", taskListener);
    task.annotations.subscribe("changed.self.*", annotationsListener);

    task.annotations.add({ key: "foo", value: "bar" });

    expect(annotationsListener).toHaveBeenCalledTimes(1);
    expect(taskListener).not.toHaveBeenCalled();
    expect(specListener).not.toHaveBeenCalled();
  });

  it("entity collections track additions and removals", () => {
    const spec = new ComponentSpec("spec_1", "Test");
    const listener = vi.fn();
    spec.tasks.subscribe("changed.self.*", listener);

    const task1 = new Task("task_1", { name: "T1", componentRef: {} });
    spec.tasks.add(task1);
    expect(listener).toHaveBeenCalledTimes(1);

    const task2 = new Task("task_2", { name: "T2", componentRef: {} });
    spec.tasks.add(task2);
    expect(listener).toHaveBeenCalledTimes(2);

    spec.tasks.removeBy((t) => t.$id === "task_1");
    expect(listener).toHaveBeenCalledTimes(3);
    expect(spec.tasks.length).toBe(1);
  });

  it("collection updates trigger single event", () => {
    const spec = new ComponentSpec("spec_1", "Test");
    const task = new Task("task_1", { name: "T1", componentRef: {} });
    task.annotations.add({ key: "old", value: "value" });
    spec.tasks.add(task);

    const listener = vi.fn();
    task.annotations.subscribe("changed.self.*", listener);

    task.annotations.update(0, { key: "new" });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(task.annotations.at(0)?.key).toBe("new");
  });

  it("AbortController properly cleans up subscriptions", () => {
    const task = new Task("task_1", { name: "T", componentRef: {} });
    const controller = new AbortController();
    const listener = vi.fn();

    task.subscribe("changed.self.*", listener, { signal: controller.signal });

    task.name = "A";
    expect(listener).toHaveBeenCalledTimes(1);

    controller.abort();
    task.name = "B";
    task.name = "C";
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("index lookups work across entity types", () => {
    const spec = new ComponentSpec("spec_1", "TestSpec");
    const task = new Task("task_1", { name: "TestTask", componentRef: {} });
    spec.tasks.add(task);

    expect(
      indexManager.findOne<ComponentSpec>("componentspec", "$id", "spec_1"),
    ).toBe(spec);
    expect(indexManager.findOne<Task>("task", "$id", "task_1")).toBe(task);
    expect(indexManager.findOne<Task>("task", "name", "TestTask")).toBe(task);
  });

  it("complex workflow: create, modify, and query", () => {
    const spec = new ComponentSpec("spec_1", "Pipeline");

    const task1 = new Task("task_1", { name: "Load", componentRef: {} });
    const task2 = new Task("task_2", { name: "Process", componentRef: {} });
    const task3 = new Task("task_3", { name: "Save", componentRef: {} });

    spec.tasks.add(task1);
    spec.tasks.add(task2);
    spec.tasks.add(task3);

    expect(indexManager.findOne<Task>("task", "name", "Process")).toBe(task2);

    task2.name = "Transform";
    expect(
      indexManager.findOne<Task>("task", "name", "Process"),
    ).toBeUndefined();
    expect(indexManager.findOne<Task>("task", "name", "Transform")).toBe(task2);

    spec.tasks.removeBy((t) => t.name === "Transform");
    expect(spec.tasks.length).toBe(2);
    expect(spec.tasks.find((t) => t.name === "Transform")).toBeUndefined();
  });
});
