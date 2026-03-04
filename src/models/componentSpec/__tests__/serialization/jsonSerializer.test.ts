import { beforeEach, describe, expect, it } from "vitest";

import { Binding } from "../../entities/binding";
import { ComponentSpec } from "../../entities/componentSpec";
import { Input } from "../../entities/input";
import { Output } from "../../entities/output";
import { Task } from "../../entities/task";
import type {
  ComponentSpecJson,
  GraphImplementation,
} from "../../entities/types";
import { IncrementingIdGenerator } from "../../factories/idGenerator";
import { JsonSerializer } from "../../serialization/jsonSerializer";

function getGraph(json: ComponentSpecJson): GraphImplementation["graph"] {
  if ("graph" in json.implementation) {
    return json.implementation.graph;
  }
  throw new Error("Expected graph implementation");
}

describe("JsonSerializer", () => {
  let serializer: JsonSerializer;
  let idGen: IncrementingIdGenerator;

  beforeEach(() => {
    serializer = new JsonSerializer();
    idGen = new IncrementingIdGenerator();
  });

  it("serializes empty spec", () => {
    const spec = new ComponentSpec({
      $id: idGen.next("spec"),
      name: "EmptyPipeline",
    });

    const json = serializer.serialize(spec);

    expect(json.name).toBe("EmptyPipeline");
    expect(getGraph(json).tasks).toEqual({});
  });

  it("serializes spec with description", () => {
    const spec = new ComponentSpec({
      $id: idGen.next("spec"),
      name: "Pipeline",
    });
    spec.setDescription("A test pipeline");

    const json = serializer.serialize(spec);

    expect(json.description).toBe("A test pipeline");
  });

  it("serializes spec with tasks", () => {
    const spec = new ComponentSpec({
      $id: idGen.next("spec"),
      name: "Pipeline",
    });
    const task = new Task({
      $id: idGen.next("task"),
      name: "Process",
      componentRef: { name: "Processor" },
    });
    spec.addTask(task);

    const json = serializer.serialize(spec);
    const graph = getGraph(json);

    expect(graph.tasks).toHaveProperty("Process");
    expect(graph.tasks["Process"].componentRef).toEqual({
      name: "Processor",
    });
  });

  it("serializes task with isEnabled", () => {
    const spec = new ComponentSpec({
      $id: idGen.next("spec"),
      name: "Pipeline",
    });
    const task = new Task({
      $id: idGen.next("task"),
      name: "Process",
      componentRef: {},
      isEnabled: { "==": { op1: "a", op2: "b" } },
    });
    spec.addTask(task);

    const json = serializer.serialize(spec);

    expect(getGraph(json).tasks["Process"].isEnabled).toEqual({
      "==": { op1: "a", op2: "b" },
    });
  });

  it("serializes metadata from annotations", () => {
    const spec = new ComponentSpec({
      $id: idGen.next("spec"),
      name: "Pipeline",
    });
    spec.setMetadata("author", "John");
    spec.setMetadata("version", "1.0");

    const json = serializer.serialize(spec);

    expect(json.metadata).toEqual({ author: "John", version: "1.0" });
  });

  it("does not include metadata in output when no metadata annotations", () => {
    const spec = new ComponentSpec({
      $id: idGen.next("spec"),
      name: "Pipeline",
    });
    spec.annotations.add({ key: "regular", value: "annotation" });

    const json = serializer.serialize(spec);

    expect(json.metadata).toBeUndefined();
  });

  it("serializes inputs", () => {
    const spec = new ComponentSpec({
      $id: idGen.next("spec"),
      name: "Pipeline",
    });
    const input = new Input({
      $id: idGen.next("input"),
      name: "data",
      type: "string",
      description: "Input data",
      defaultValue: "default",
      optional: true,
    });
    spec.addInput(input);

    const json = serializer.serialize(spec);

    expect(json.inputs).toHaveLength(1);
    expect(json.inputs![0]).toEqual({
      name: "data",
      type: "string",
      description: "Input data",
      default: "default",
      optional: true,
    });
  });

  it("serializes outputs", () => {
    const spec = new ComponentSpec({
      $id: idGen.next("spec"),
      name: "Pipeline",
    });
    const output = new Output({
      $id: idGen.next("output"),
      name: "result",
      type: "object",
      description: "Output result",
    });
    spec.addOutput(output);

    const json = serializer.serialize(spec);

    expect(json.outputs).toHaveLength(1);
    expect(json.outputs![0]).toEqual({
      name: "result",
      type: "object",
      description: "Output result",
    });
  });

  it("serializes bindings as task arguments (graph input)", () => {
    const spec = new ComponentSpec({
      $id: idGen.next("spec"),
      name: "Pipeline",
    });
    const input = new Input({
      $id: idGen.next("input"),
      name: "data",
    });
    const task = new Task({
      $id: idGen.next("task"),
      name: "Process",
      componentRef: {},
    });
    const binding = new Binding({
      $id: idGen.next("binding"),
      sourceEntityId: input.$id,
      sourcePortName: "data",
      targetEntityId: task.$id,
      targetPortName: "input",
    });
    spec.addInput(input);
    spec.addTask(task);
    spec.addBinding(binding);

    const json = serializer.serialize(spec);

    expect(getGraph(json).tasks["Process"].arguments).toEqual({
      input: { graphInput: { inputName: "data" } },
    });
  });

  it("serializes bindings as task arguments (task output)", () => {
    const spec = new ComponentSpec({
      $id: idGen.next("spec"),
      name: "Pipeline",
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
    const binding = new Binding({
      $id: idGen.next("binding"),
      sourceEntityId: task1.$id,
      sourcePortName: "output",
      targetEntityId: task2.$id,
      targetPortName: "input",
    });
    spec.addTask(task1);
    spec.addTask(task2);
    spec.addBinding(binding);

    const json = serializer.serialize(spec);

    expect(getGraph(json).tasks["Task2"].arguments).toEqual({
      input: { taskOutput: { taskId: "Task1", outputName: "output" } },
    });
  });

  it("serializes output values", () => {
    const spec = new ComponentSpec({
      $id: idGen.next("spec"),
      name: "Pipeline",
    });
    const task = new Task({
      $id: idGen.next("task"),
      name: "Process",
      componentRef: {},
    });
    const output = new Output({
      $id: idGen.next("output"),
      name: "result",
    });
    const binding = new Binding({
      $id: idGen.next("binding"),
      sourceEntityId: task.$id,
      sourcePortName: "processed",
      targetEntityId: output.$id,
      targetPortName: "result",
    });
    spec.addTask(task);
    spec.addOutput(output);
    spec.addBinding(binding);

    const json = serializer.serialize(spec);

    expect(getGraph(json).outputValues).toEqual({
      result: { taskOutput: { taskId: "Process", outputName: "processed" } },
    });
  });

  it("serializes task annotations", () => {
    const spec = new ComponentSpec({
      $id: idGen.next("spec"),
      name: "Pipeline",
    });
    const task = new Task({
      $id: idGen.next("task"),
      name: "Process",
      componentRef: {},
    });
    task.annotations.add({ key: "note", value: "important" });
    spec.addTask(task);

    const json = serializer.serialize(spec);

    expect(getGraph(json).tasks["Process"].annotations).toEqual({
      note: "important",
    });
  });

  it("serializes input annotations", () => {
    const spec = new ComponentSpec({
      $id: idGen.next("spec"),
      name: "Pipeline",
    });
    const input = new Input({
      $id: idGen.next("input"),
      name: "data",
    });
    input.annotations.add({ key: "format", value: "json" });
    spec.addInput(input);

    const json = serializer.serialize(spec);

    expect(json.inputs![0].annotations).toEqual({ format: "json" });
  });

  it("serializes literal argument values from task", () => {
    const spec = new ComponentSpec({
      $id: idGen.next("spec"),
      name: "Pipeline",
    });
    const task = new Task({
      $id: idGen.next("task"),
      name: "Process",
      componentRef: {},
    });
    task.addArgument({ name: "param", value: "literal_value" });
    spec.addTask(task);

    const json = serializer.serialize(spec);

    expect(getGraph(json).tasks["Process"].arguments).toEqual({
      param: "literal_value",
    });
  });
});
