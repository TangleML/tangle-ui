import { describe, expect, it } from "vitest";

import { Binding } from "../../entities/binding";
import { ComponentSpec } from "../../entities/componentSpec";
import { Input } from "../../entities/input";
import { Output } from "../../entities/output";
import { Task } from "../../entities/task";

describe("ComponentSpec", () => {
  it("creates with name", () => {
    const spec = new ComponentSpec({ $id: "spec_1", name: "MyPipeline" });

    expect(spec.$id).toBe("spec_1");
    expect(spec.name).toBe("MyPipeline");
  });

  it("has empty collections by default", () => {
    const spec = new ComponentSpec({ $id: "spec_1", name: "Test" });

    expect(spec.inputs.length).toBe(0);
    expect(spec.outputs.length).toBe(0);
    expect(spec.tasks.length).toBe(0);
    expect(spec.bindings.length).toBe(0);
    expect(spec.annotations.length).toBe(0);
  });

  it("getMetadata returns undefined for missing key", () => {
    const spec = new ComponentSpec({ $id: "spec_1", name: "Test" });
    expect(spec.getMetadata("missing")).toBeUndefined();
  });

  it("setMetadata creates annotation without prefix", () => {
    const spec = new ComponentSpec({ $id: "spec_1", name: "Test" });

    spec.setMetadata("author", "John");

    expect(spec.getMetadata("author")).toBe("John");
    expect(spec.annotations.find((a) => a.key === "author")).toBeDefined();
  });

  it("setMetadata updates existing annotation", () => {
    const spec = new ComponentSpec({ $id: "spec_1", name: "Test" });
    spec.setMetadata("version", "1.0");

    spec.setMetadata("version", "2.0");

    expect(spec.getMetadata("version")).toBe("2.0");
    expect(spec.annotations.filter((a) => a.key === "version").length).toBe(1);
  });

  it("setName updates name", () => {
    const spec = new ComponentSpec({ $id: "spec_1", name: "OldName" });

    spec.setName("NewName");

    expect(spec.name).toBe("NewName");
  });

  it("setDescription updates description", () => {
    const spec = new ComponentSpec({ $id: "spec_1", name: "Test" });

    spec.setDescription("A description");

    expect(spec.description).toBe("A description");
  });

  it("addTask adds task to tasks", () => {
    const spec = new ComponentSpec({ $id: "spec_1", name: "Test" });

    const task = new Task({
      $id: "task_1",
      name: "T1",
      componentRef: {},
    });
    spec.addTask(task);

    expect(spec.tasks.length).toBe(1);
  });

  it("addInput adds input to inputs", () => {
    const spec = new ComponentSpec({ $id: "spec_1", name: "Test" });

    const input = new Input({ $id: "input_1", name: "data" });
    spec.addInput(input);

    expect(spec.inputs.length).toBe(1);
  });

  it("addOutput adds output to outputs", () => {
    const spec = new ComponentSpec({ $id: "spec_1", name: "Test" });

    const output = new Output({ $id: "output_1", name: "result" });
    spec.addOutput(output);

    expect(spec.outputs.length).toBe(1);
  });

  it("addBinding adds binding to bindings", () => {
    const spec = new ComponentSpec({ $id: "spec_1", name: "Test" });

    const binding = new Binding({
      $id: "binding_1",
      sourceEntityId: "t1",
      targetEntityId: "t2",
      sourcePortName: "out",
      targetPortName: "in",
    });
    spec.addBinding(binding);

    expect(spec.bindings.length).toBe(1);
  });

  it("can add multiple tasks", () => {
    const spec = new ComponentSpec({ $id: "spec_1", name: "Test" });

    const task1 = new Task({
      $id: "task_1",
      name: "T1",
      componentRef: {},
    });
    const task2 = new Task({
      $id: "task_2",
      name: "T2",
      componentRef: {},
    });
    const task3 = new Task({
      $id: "task_3",
      name: "T3",
      componentRef: {},
    });

    spec.addTask(task1);
    spec.addTask(task2);
    spec.addTask(task3);

    expect(spec.tasks.length).toBe(3);
    expect(spec.tasks.find((t) => t.name === "T2")).toBe(task2);
  });

  it("can remove tasks", () => {
    const spec = new ComponentSpec({ $id: "spec_1", name: "Test" });

    const task1 = new Task({
      $id: "task_1",
      name: "T1",
      componentRef: {},
    });
    const task2 = new Task({
      $id: "task_2",
      name: "T2",
      componentRef: {},
    });

    spec.addTask(task1);
    spec.addTask(task2);

    spec.removeTaskBy((t) => t.$id === "task_1");

    expect(spec.tasks.length).toBe(1);
    expect(spec.tasks.at(0)).toBe(task2);
  });
});
