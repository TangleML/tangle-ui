import { beforeEach, describe, expect, it, vi } from "vitest";

import { Binding } from "../../entities/binding";
import { ComponentSpec } from "../../entities/componentSpec";
import { Input } from "../../entities/input";
import { Output } from "../../entities/output";
import { Task } from "../../entities/task";
import { indexManager, resetIndexManager } from "../../indexes/indexManager";

describe("ComponentSpec", () => {
  beforeEach(() => resetIndexManager());

  it("creates with name", () => {
    const spec = new ComponentSpec("spec_1", "MyPipeline");

    expect(spec.$id).toBe("spec_1");
    expect(spec.name).toBe("MyPipeline");
  });

  it("has empty collections by default", () => {
    const spec = new ComponentSpec("spec_1", "Test");

    expect(spec.inputs.length).toBe(0);
    expect(spec.outputs.length).toBe(0);
    expect(spec.tasks.length).toBe(0);
    expect(spec.bindings.length).toBe(0);
    expect(spec.annotations.length).toBe(0);
  });

  it("getMetadata returns undefined for missing key", () => {
    const spec = new ComponentSpec("spec_1", "Test");
    expect(spec.getMetadata("missing")).toBeUndefined();
  });

  it("setMetadata creates annotation with metadata. prefix", () => {
    const spec = new ComponentSpec("spec_1", "Test");

    spec.setMetadata("author", "John");

    expect(spec.getMetadata("author")).toBe("John");
    expect(
      spec.annotations.find((a) => a.key === "metadata.author"),
    ).toBeDefined();
  });

  it("setMetadata updates existing annotation", () => {
    const spec = new ComponentSpec("spec_1", "Test");
    spec.setMetadata("version", "1.0");

    spec.setMetadata("version", "2.0");

    expect(spec.getMetadata("version")).toBe("2.0");
    expect(
      spec.annotations.filter((a) => a.key === "metadata.version").length,
    ).toBe(1);
  });

  it('$namespace is "componentspec"', () => {
    const spec = new ComponentSpec("spec_1", "Test");
    expect(spec.$namespace).toBe("componentspec");
  });

  it("is indexed by $id", () => {
    const spec = new ComponentSpec("spec_1", "Test");
    expect(
      indexManager.findOne<ComponentSpec>("componentspec", "$id", "spec_1"),
    ).toBe(spec);
  });

  it("emits change when name changes", () => {
    const spec = new ComponentSpec("spec_1", "OldName");
    const listener = vi.fn();
    spec.subscribe("changed.self.*", listener);

    spec.name = "NewName";

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        field: "name",
        value: "NewName",
        oldValue: "OldName",
      }),
    );
  });

  it("emits change when description changes", () => {
    const spec = new ComponentSpec("spec_1", "Test");
    const listener = vi.fn();
    spec.subscribe("changed.self.*", listener);

    spec.description = "A description";

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        field: "description",
        value: "A description",
        oldValue: undefined,
      }),
    );
  });

  it("tasks collection is reactive", () => {
    const spec = new ComponentSpec("spec_1", "Test");
    const listener = vi.fn();
    spec.tasks.subscribe("changed.self.*", listener);

    const task = new Task("task_1", { name: "T1", componentRef: {} });
    spec.tasks.add(task);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(spec.tasks.length).toBe(1);
  });

  it("inputs collection is reactive", () => {
    const spec = new ComponentSpec("spec_1", "Test");
    const listener = vi.fn();
    spec.inputs.subscribe("changed.self.*", listener);

    const input = new Input("input_1", "data");
    spec.inputs.add(input);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(spec.inputs.length).toBe(1);
  });

  it("outputs collection is reactive", () => {
    const spec = new ComponentSpec("spec_1", "Test");
    const listener = vi.fn();
    spec.outputs.subscribe("changed.self.*", listener);

    const output = new Output("output_1", "result");
    spec.outputs.add(output);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(spec.outputs.length).toBe(1);
  });

  it("bindings collection is reactive", () => {
    const spec = new ComponentSpec("spec_1", "Test");
    const listener = vi.fn();
    spec.bindings.subscribe("changed.self.*", listener);

    const binding = new Binding("binding_1", {
      source: { entityId: "t1", portName: "out" },
      target: { entityId: "t2", portName: "in" },
    });
    spec.bindings.add(binding);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(spec.bindings.length).toBe(1);
  });

  it("can add multiple tasks", () => {
    const spec = new ComponentSpec("spec_1", "Test");

    const task1 = new Task("task_1", { name: "T1", componentRef: {} });
    const task2 = new Task("task_2", { name: "T2", componentRef: {} });
    const task3 = new Task("task_3", { name: "T3", componentRef: {} });

    spec.tasks.add(task1);
    spec.tasks.add(task2);
    spec.tasks.add(task3);

    expect(spec.tasks.length).toBe(3);
    expect(spec.tasks.find((t) => t.name === "T2")).toBe(task2);
  });

  it("can remove tasks", () => {
    const spec = new ComponentSpec("spec_1", "Test");

    const task1 = new Task("task_1", { name: "T1", componentRef: {} });
    const task2 = new Task("task_2", { name: "T2", componentRef: {} });

    spec.tasks.add(task1);
    spec.tasks.add(task2);

    spec.tasks.removeBy((t) => t.$id === "task_1");

    expect(spec.tasks.length).toBe(1);
    expect(spec.tasks.at(0)).toBe(task2);
  });
});
