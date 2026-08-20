import { beforeEach, describe, expect, it } from "vitest";

import { IS_ENABLED_PORT_NAME } from "@/utils/conditionalExecution";

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
      isEnabled: { taskOutput: { taskId: "task1", outputName: "out1" } },
    });
    spec.addTask(task);

    const json = serializer.serialize(spec);

    expect(getGraph(json).tasks["Process"].isEnabled).toEqual({
      taskOutput: { taskId: "task1", outputName: "out1" },
    });
  });

  it("serializes literal isEnabled 'false'", () => {
    const spec = new ComponentSpec({
      $id: idGen.next("spec"),
      name: "Pipeline",
    });
    const task = new Task({
      $id: idGen.next("task"),
      name: "Process",
      componentRef: {},
      isEnabled: "false",
    });
    spec.addTask(task);

    expect(
      getGraph(serializer.serialize(spec)).tasks["Process"].isEnabled,
    ).toBe("false");
  });

  it("serializes a connection to the reserved is-enabled port as isEnabled (task output)", () => {
    const spec = new ComponentSpec({
      $id: idGen.next("spec"),
      name: "Pipeline",
    });
    const producer = new Task({
      $id: idGen.next("task"),
      name: "Producer",
      componentRef: {},
    });
    const consumer = new Task({
      $id: idGen.next("task"),
      name: "Consumer",
      componentRef: {},
    });
    spec.addTask(producer);
    spec.addTask(consumer);
    spec.addBinding(
      new Binding({
        $id: idGen.next("binding"),
        sourceEntityId: producer.$id,
        sourcePortName: "should_run",
        targetEntityId: consumer.$id,
        targetPortName: IS_ENABLED_PORT_NAME,
      }),
    );

    const consumerSpec = getGraph(serializer.serialize(spec)).tasks["Consumer"];
    expect(consumerSpec.isEnabled).toEqual({
      taskOutput: { taskId: "Producer", outputName: "should_run" },
    });
    // The reserved-port binding must not leak into arguments.
    expect(consumerSpec.arguments).toBeUndefined();
  });

  it("serializes a graph-input connection to the reserved is-enabled port", () => {
    const spec = new ComponentSpec({
      $id: idGen.next("spec"),
      name: "Pipeline",
    });
    const input = new Input({ $id: idGen.next("input"), name: "run_it" });
    const task = new Task({
      $id: idGen.next("task"),
      name: "Consumer",
      componentRef: {},
    });
    spec.addInput(input);
    spec.addTask(task);
    spec.addBinding(
      new Binding({
        $id: idGen.next("binding"),
        sourceEntityId: input.$id,
        sourcePortName: "run_it",
        targetEntityId: task.$id,
        targetPortName: IS_ENABLED_PORT_NAME,
      }),
    );

    expect(
      getGraph(serializer.serialize(spec)).tasks["Consumer"].isEnabled,
    ).toEqual({ graphInput: { inputName: "run_it" } });
  });

  it("serializes metadata from annotations", () => {
    const spec = new ComponentSpec({
      $id: idGen.next("spec"),
      name: "Pipeline",
    });
    spec.setMetadata("author", "John");
    spec.setMetadata("version", "1.0");

    const json = serializer.serialize(spec);

    expect(json.metadata).toEqual({
      annotations: { author: "John", version: "1.0" },
    });
  });

  it("does not include metadata in output when no annotations", () => {
    const spec = new ComponentSpec({
      $id: idGen.next("spec"),
      name: "Pipeline",
    });

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

  it("serializes inputs with pipeline value", () => {
    const spec = new ComponentSpec({
      $id: idGen.next("spec"),
      name: "Pipeline",
    });
    spec.addInput(
      new Input({
        $id: idGen.next("input"),
        name: "data",
        value: "run-time",
      }),
    );

    const json = serializer.serialize(spec);

    expect(json.inputs![0]).toMatchObject({
      name: "data",
      value: "run-time",
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

  it("serializes task with executionOptions", () => {
    const spec = new ComponentSpec({
      $id: idGen.next("spec"),
      name: "Pipeline",
    });
    const task = new Task({
      $id: idGen.next("task"),
      name: "Process",
      componentRef: {},
      executionOptions: {
        cachingStrategy: { maxCacheStaleness: "P0D" },
      },
    });
    spec.addTask(task);

    const json = serializer.serialize(spec);

    expect(getGraph(json).tasks["Process"].executionOptions).toEqual({
      cachingStrategy: { maxCacheStaleness: "P0D" },
    });
  });

  it("does not include executionOptions when undefined", () => {
    const spec = new ComponentSpec({
      $id: idGen.next("spec"),
      name: "Pipeline",
    });
    const task = new Task({
      $id: idGen.next("task"),
      name: "Process",
      componentRef: {},
    });
    spec.addTask(task);

    const json = serializer.serialize(spec);

    expect(getGraph(json).tasks["Process"].executionOptions).toBeUndefined();
  });

  it("serializes dynamicData argument values from task", () => {
    const spec = new ComponentSpec({
      $id: idGen.next("spec"),
      name: "Pipeline",
    });
    const task = new Task({
      $id: idGen.next("task"),
      name: "Process",
      componentRef: {},
    });
    task.addArgument({
      name: "api_key",
      value: { dynamicData: { secret: { name: "my-secret" } } },
    });
    spec.addTask(task);

    const json = serializer.serialize(spec);

    expect(getGraph(json).tasks["Process"].arguments).toEqual({
      api_key: { dynamicData: { secret: { name: "my-secret" } } },
    });
  });
});
