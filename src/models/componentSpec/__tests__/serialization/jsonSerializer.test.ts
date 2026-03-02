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
import { resetIndexManager } from "../../indexes/indexManager";
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
    resetIndexManager();
    serializer = new JsonSerializer();
    idGen = new IncrementingIdGenerator();
  });

  it("serializes empty spec", () => {
    const spec = new ComponentSpec(idGen.next("spec"), "EmptyPipeline");

    const json = serializer.serialize(spec);

    expect(json.name).toBe("EmptyPipeline");
    expect(getGraph(json).tasks).toEqual({});
  });

  it("serializes spec with description", () => {
    const spec = new ComponentSpec(idGen.next("spec"), "Pipeline");
    spec.description = "A test pipeline";

    const json = serializer.serialize(spec);

    expect(json.description).toBe("A test pipeline");
  });

  it("serializes spec with tasks", () => {
    const spec = new ComponentSpec(idGen.next("spec"), "Pipeline");
    const task = new Task(idGen.next("task"), {
      name: "Process",
      componentRef: { name: "Processor" },
    });
    spec.tasks.add(task);

    const json = serializer.serialize(spec);
    const graph = getGraph(json);

    expect(graph.tasks).toHaveProperty("Process");
    expect(graph.tasks["Process"].componentRef).toEqual({
      name: "Processor",
    });
  });

  it("serializes task with isEnabled", () => {
    const spec = new ComponentSpec(idGen.next("spec"), "Pipeline");
    const task = new Task(idGen.next("task"), {
      name: "Process",
      componentRef: {},
      isEnabled: { "==": { op1: "a", op2: "b" } },
    });
    spec.tasks.add(task);

    const json = serializer.serialize(spec);

    expect(getGraph(json).tasks["Process"].isEnabled).toEqual({
      "==": { op1: "a", op2: "b" },
    });
  });

  it("serializes metadata from annotations", () => {
    const spec = new ComponentSpec(idGen.next("spec"), "Pipeline");
    spec.setMetadata("author", "John");
    spec.setMetadata("version", "1.0");

    const json = serializer.serialize(spec);

    expect(json.metadata).toEqual({ author: "John", version: "1.0" });
  });

  it("does not include metadata in output when no metadata annotations", () => {
    const spec = new ComponentSpec(idGen.next("spec"), "Pipeline");
    spec.annotations.add({ key: "regular", value: "annotation" });

    const json = serializer.serialize(spec);

    expect(json.metadata).toBeUndefined();
  });

  it("serializes inputs", () => {
    const spec = new ComponentSpec(idGen.next("spec"), "Pipeline");
    const input = new Input(idGen.next("input"), {
      name: "data",
      type: "string",
      description: "Input data",
      defaultValue: "default",
      optional: true,
    });
    spec.inputs.add(input);

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
    const spec = new ComponentSpec(idGen.next("spec"), "Pipeline");
    const output = new Output(idGen.next("output"), {
      name: "result",
      type: "object",
      description: "Output result",
    });
    spec.outputs.add(output);

    const json = serializer.serialize(spec);

    expect(json.outputs).toHaveLength(1);
    expect(json.outputs![0]).toEqual({
      name: "result",
      type: "object",
      description: "Output result",
    });
  });

  it("serializes bindings as task arguments (graph input)", () => {
    const spec = new ComponentSpec(idGen.next("spec"), "Pipeline");
    const input = new Input(idGen.next("input"), "data");
    const task = new Task(idGen.next("task"), {
      name: "Process",
      componentRef: {},
    });
    const binding = new Binding(idGen.next("binding"), {
      source: { entityId: input.$id, portName: "data" },
      target: { entityId: task.$id, portName: "input" },
    });
    spec.inputs.add(input);
    spec.tasks.add(task);
    spec.bindings.add(binding);

    const json = serializer.serialize(spec);

    expect(getGraph(json).tasks["Process"].arguments).toEqual({
      input: { graphInput: { inputName: "data" } },
    });
  });

  it("serializes bindings as task arguments (task output)", () => {
    const spec = new ComponentSpec(idGen.next("spec"), "Pipeline");
    const task1 = new Task(idGen.next("task"), {
      name: "Task1",
      componentRef: {},
    });
    const task2 = new Task(idGen.next("task"), {
      name: "Task2",
      componentRef: {},
    });
    const binding = new Binding(idGen.next("binding"), {
      source: { entityId: task1.$id, portName: "output" },
      target: { entityId: task2.$id, portName: "input" },
    });
    spec.tasks.add(task1);
    spec.tasks.add(task2);
    spec.bindings.add(binding);

    const json = serializer.serialize(spec);

    expect(getGraph(json).tasks["Task2"].arguments).toEqual({
      input: { taskOutput: { taskId: "Task1", outputName: "output" } },
    });
  });

  it("serializes output values", () => {
    const spec = new ComponentSpec(idGen.next("spec"), "Pipeline");
    const task = new Task(idGen.next("task"), {
      name: "Process",
      componentRef: {},
    });
    const output = new Output(idGen.next("output"), "result");
    const binding = new Binding(idGen.next("binding"), {
      source: { entityId: task.$id, portName: "processed" },
      target: { entityId: output.$id, portName: "result" },
    });
    spec.tasks.add(task);
    spec.outputs.add(output);
    spec.bindings.add(binding);

    const json = serializer.serialize(spec);

    expect(getGraph(json).outputValues).toEqual({
      result: { taskOutput: { taskId: "Process", outputName: "processed" } },
    });
  });

  it("serializes task annotations", () => {
    const spec = new ComponentSpec(idGen.next("spec"), "Pipeline");
    const task = new Task(idGen.next("task"), {
      name: "Process",
      componentRef: {},
    });
    task.annotations.add({ key: "note", value: "important" });
    spec.tasks.add(task);

    const json = serializer.serialize(spec);

    expect(getGraph(json).tasks["Process"].annotations).toEqual({
      note: "important",
    });
  });

  it("serializes input annotations", () => {
    const spec = new ComponentSpec(idGen.next("spec"), "Pipeline");
    const input = new Input(idGen.next("input"), "data");
    input.annotations.add({ key: "format", value: "json" });
    spec.inputs.add(input);

    const json = serializer.serialize(spec);

    expect(json.inputs![0].annotations).toEqual({ format: "json" });
  });

  it("serializes literal argument values from task", () => {
    const spec = new ComponentSpec(idGen.next("spec"), "Pipeline");
    const task = new Task(idGen.next("task"), {
      name: "Process",
      componentRef: {},
    });
    task.arguments.add({ name: "param", value: "literal_value" });
    spec.tasks.add(task);

    const json = serializer.serialize(spec);

    expect(getGraph(json).tasks["Process"].arguments).toEqual({
      param: "literal_value",
    });
  });
});
