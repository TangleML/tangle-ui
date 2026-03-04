import { beforeEach, describe, expect, it } from "vitest";

import { createSubgraph } from "../../actions/createSubgraph";
import { Binding } from "../../entities/binding";
import { ComponentSpec } from "../../entities/componentSpec";
import { Input } from "../../entities/input";
import { Task } from "../../entities/task";
import { IncrementingIdGenerator } from "../../factories/idGenerator";

describe("createSubgraph", () => {
  let idGen: IncrementingIdGenerator;

  beforeEach(() => {
    idGen = new IncrementingIdGenerator();
  });

  it("extracts selected tasks into subgraph", () => {
    const spec = new ComponentSpec({
      $id: idGen.next("spec"),
      name: "Main",
    });
    const task1 = new Task({
      $id: idGen.next("task"),
      name: "Task1",
      componentRef: {},
    });
    const task2 = new Task({
      $id: idGen.next("task"),
      name: "Task2",
      componentRef: {},
    });
    const task3 = new Task({
      $id: idGen.next("task"),
      name: "Task3",
      componentRef: {},
    });
    spec.addTask(task1);
    spec.addTask(task2);
    spec.addTask(task3);

    const result = createSubgraph({
      spec,
      selectedTaskIds: [task1.$id, task2.$id],
      subgraphName: "Subgraph",
      idGen,
    });

    expect(result).not.toBeNull();
    expect(result!.subgraphSpec.tasks.length).toBe(2);
    expect(spec.tasks.length).toBe(2);
    expect(result!.replacementTask.name).toBe("Subgraph");
  });

  it("creates subgraph inputs for external connections", () => {
    const spec = new ComponentSpec({
      $id: idGen.next("spec"),
      name: "Main",
    });
    const input = new Input({
      $id: idGen.next("input"),
      name: "external_data",
    });
    const task = new Task({
      $id: idGen.next("task"),
      name: "InnerTask",
      componentRef: {},
    });
    const binding = new Binding({
      $id: idGen.next("binding"),
      sourceEntityId: input.$id,
      sourcePortName: "external_data",
      targetEntityId: task.$id,
      targetPortName: "data",
    });
    spec.addInput(input);
    spec.addTask(task);
    spec.addBinding(binding);

    const result = createSubgraph({
      spec,
      selectedTaskIds: [task.$id],
      subgraphName: "Sub",
      idGen,
    });

    expect(result).not.toBeNull();
    expect(result!.subgraphSpec.inputs.length).toBe(1);
    expect(result!.subgraphSpec.inputs.at(0)?.name).toBe("data");
  });

  it("moves internal bindings to subgraph", () => {
    const spec = new ComponentSpec({
      $id: idGen.next("spec"),
      name: "Main",
    });
    const task1 = new Task({
      $id: idGen.next("task"),
      name: "T1",
      componentRef: {},
    });
    const task2 = new Task({
      $id: idGen.next("task"),
      name: "T2",
      componentRef: {},
    });
    const binding = new Binding({
      $id: idGen.next("binding"),
      sourceEntityId: task1.$id,
      sourcePortName: "out",
      targetEntityId: task2.$id,
      targetPortName: "in",
    });
    spec.addTask(task1);
    spec.addTask(task2);
    spec.addBinding(binding);

    const result = createSubgraph({
      spec,
      selectedTaskIds: [task1.$id, task2.$id],
      subgraphName: "Sub",
      idGen,
    });

    expect(result).not.toBeNull();
    expect(result!.subgraphSpec.bindings.length).toBe(1);
    expect(spec.bindings.length).toBe(0);
  });

  it("creates replacement task with correct componentRef", () => {
    const spec = new ComponentSpec({
      $id: idGen.next("spec"),
      name: "Main",
    });
    const task = new Task({
      $id: idGen.next("task"),
      name: "T1",
      componentRef: {},
    });
    spec.addTask(task);

    const result = createSubgraph({
      spec,
      selectedTaskIds: [task.$id],
      subgraphName: "MySub",
      idGen,
    });

    expect(result).not.toBeNull();
    expect(result!.replacementTask.componentRef.name).toBe("MySub");
    expect(result!.replacementTask.name).toBe("MySub");
  });

  it("handles single task selection", () => {
    const spec = new ComponentSpec({
      $id: idGen.next("spec"),
      name: "Main",
    });
    const task1 = new Task({
      $id: idGen.next("task"),
      name: "T1",
      componentRef: {},
    });
    const task2 = new Task({
      $id: idGen.next("task"),
      name: "T2",
      componentRef: {},
    });
    spec.addTask(task1);
    spec.addTask(task2);

    const result = createSubgraph({
      spec,
      selectedTaskIds: [task1.$id],
      subgraphName: "Sub",
      idGen,
    });

    expect(result).not.toBeNull();
    expect(result!.subgraphSpec.tasks.length).toBe(1);
    expect(result!.subgraphSpec.tasks.at(0)?.name).toBe("T1");
  });

  it("preserves task properties in subgraph", () => {
    const spec = new ComponentSpec({
      $id: idGen.next("spec"),
      name: "Main",
    });
    const task = new Task({
      $id: idGen.next("task"),
      name: "ConfiguredTask",
      componentRef: { name: "MyComponent" },
      isEnabled: { "==": { op1: "a", op2: "b" } },
    });
    task.annotations.add({ key: "note", value: "test" });
    spec.addTask(task);

    const result = createSubgraph({
      spec,
      selectedTaskIds: [task.$id],
      subgraphName: "Sub",
      idGen,
    });

    expect(result).not.toBeNull();
    const movedTask = result!.subgraphSpec.tasks.at(0);
    expect(movedTask?.name).toBe("ConfiguredTask");
    expect(movedTask?.componentRef).toEqual({ name: "MyComponent" });
    expect(movedTask?.isEnabled).toEqual({ "==": { op1: "a", op2: "b" } });
    expect(movedTask?.annotations.length).toBe(1);
  });

  it("returns null for empty selection", () => {
    const spec = new ComponentSpec({
      $id: idGen.next("spec"),
      name: "Main",
    });
    const task = new Task({
      $id: idGen.next("task"),
      name: "T1",
      componentRef: {},
    });
    spec.addTask(task);

    const result = createSubgraph({
      spec,
      selectedTaskIds: [],
      subgraphName: "EmptySub",
      idGen,
    });

    expect(result).toBeNull();
    expect(spec.tasks.length).toBe(1);
  });

  it("subgraph spec has correct name", () => {
    const spec = new ComponentSpec({
      $id: idGen.next("spec"),
      name: "Main",
    });
    const task = new Task({
      $id: idGen.next("task"),
      name: "T1",
      componentRef: {},
    });
    spec.addTask(task);

    const result = createSubgraph({
      spec,
      selectedTaskIds: [task.$id],
      subgraphName: "MySubgraph",
      idGen,
    });

    expect(result).not.toBeNull();
    expect(result!.subgraphSpec.name).toBe("MySubgraph");
  });
});
