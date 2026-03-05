import { beforeEach, describe, expect, it } from "vitest";

import type {
  ComponentSpecJson,
  GraphImplementation,
} from "../../entities/types";
import { IncrementingIdGenerator } from "../../factories/idGenerator";
import { JsonSerializer } from "../../serialization/jsonSerializer";
import { YamlDeserializer } from "../../serialization/yamlDeserializer";

function getGraph(json: ComponentSpecJson): GraphImplementation["graph"] {
  if ("graph" in json.implementation) {
    return json.implementation.graph;
  }
  throw new Error("Expected graph implementation");
}

describe("Serialization Roundtrip", () => {
  let serializer: JsonSerializer;
  let deserializer: YamlDeserializer;

  beforeEach(() => {
    const idGen = new IncrementingIdGenerator();
    serializer = new JsonSerializer();
    deserializer = new YamlDeserializer(idGen);
  });

  it("YAML -> Object -> JSON preserves structure", () => {
    const yaml = {
      name: "RoundtripTest",
      description: "A test pipeline",
      inputs: [{ name: "data", type: "string" }],
      outputs: [{ name: "result", type: "string" }],
      metadata: { author: "Test", version: "1.0" },
      implementation: {
        graph: {
          tasks: {
            ProcessTask: {
              componentRef: { name: "Processor" },
              arguments: { input: "{{inputs.data}}" },
            },
          },
          outputValues: {
            result: {
              taskOutput: { taskId: "ProcessTask", outputName: "output" },
            },
          },
        },
      },
    };

    const spec = deserializer.deserialize(yaml);
    const json = serializer.serialize(spec);

    expect(json.name).toBe(yaml.name);
    expect(json.description).toBe(yaml.description);
    expect(json.metadata).toEqual({
      annotations: { author: "Test", version: "1.0" },
    });
    expect(Object.keys(getGraph(json).tasks)).toContain("ProcessTask");
  });

  it("complex spec with multiple tasks and bindings", () => {
    const yaml = {
      name: "ComplexPipeline",
      inputs: [{ name: "raw_data" }],
      outputs: [{ name: "processed" }],
      implementation: {
        graph: {
          tasks: {
            Validate: {
              componentRef: { name: "Validator" },
              arguments: { data: "{{inputs.raw_data}}" },
            },
            Transform: {
              componentRef: { name: "Transformer" },
              arguments: { data: "{{tasks.Validate.outputs.validated}}" },
            },
            Aggregate: {
              componentRef: { name: "Aggregator" },
              arguments: { data: "{{tasks.Transform.outputs.transformed}}" },
            },
          },
          outputValues: {
            processed: {
              taskOutput: { taskId: "Aggregate", outputName: "result" },
            },
          },
        },
      },
    };

    const spec = deserializer.deserialize(yaml);

    expect(spec.tasks.length).toBe(3);
    expect(spec.bindings.length).toBeGreaterThan(0);

    const json = serializer.serialize(spec);
    expect(Object.keys(getGraph(json).tasks)).toHaveLength(3);
  });

  it("preserves input properties", () => {
    const yaml = {
      name: "InputTest",
      inputs: [
        {
          name: "required_input",
          type: "string",
          description: "A required input",
        },
        {
          name: "optional_input",
          type: "number",
          optional: true,
          default: "42",
        },
      ],
      implementation: { graph: { tasks: {} } },
    };

    const spec = deserializer.deserialize(yaml);
    const json = serializer.serialize(spec);

    expect(json.inputs).toHaveLength(2);
    expect(json.inputs![0]).toEqual({
      name: "required_input",
      type: "string",
      description: "A required input",
    });
    expect(json.inputs![1]).toEqual({
      name: "optional_input",
      type: "number",
      optional: true,
      default: "42",
    });
  });

  it("preserves output properties", () => {
    const yaml = {
      name: "OutputTest",
      outputs: [
        {
          name: "result",
          type: "object",
          description: "The result",
        },
      ],
      implementation: { graph: { tasks: {} } },
    };

    const spec = deserializer.deserialize(yaml);
    const json = serializer.serialize(spec);

    expect(json.outputs).toHaveLength(1);
    expect(json.outputs![0]).toEqual({
      name: "result",
      type: "object",
      description: "The result",
    });
  });

  it("preserves task annotations", () => {
    const yaml = {
      name: "AnnotationTest",
      implementation: {
        graph: {
          tasks: {
            AnnotatedTask: {
              componentRef: {},
              annotations: { priority: "high", category: "processing" },
            },
          },
        },
      },
    };

    const spec = deserializer.deserialize(yaml);
    const json = serializer.serialize(spec);

    expect(getGraph(json).tasks["AnnotatedTask"].annotations).toEqual({
      priority: "high",
      category: "processing",
    });
  });

  it("preserves isEnabled predicate", () => {
    const yaml = {
      name: "ConditionalTest",
      implementation: {
        graph: {
          tasks: {
            ConditionalTask: {
              componentRef: {},
              isEnabled: { "!=": { op1: "a", op2: "b" } },
            },
          },
        },
      },
    };

    const spec = deserializer.deserialize(yaml);
    const json = serializer.serialize(spec);

    expect(getGraph(json).tasks["ConditionalTask"].isEnabled).toEqual({
      "!=": { op1: "a", op2: "b" },
    });
  });

  it("handles empty spec correctly", () => {
    const yaml = {
      name: "EmptySpec",
    };

    const spec = deserializer.deserialize(yaml);
    const json = serializer.serialize(spec);

    expect(json.name).toBe("EmptySpec");
    expect(getGraph(json).tasks).toEqual({});
    expect(json.inputs).toBeUndefined();
    expect(json.outputs).toBeUndefined();
    expect(json.metadata).toBeUndefined();
  });

  it("binding arguments are serialized correctly", () => {
    const yaml = {
      name: "BindingTest",
      inputs: [{ name: "input1" }],
      implementation: {
        graph: {
          tasks: {
            Task1: {
              componentRef: {},
              arguments: {
                data: { graphInput: { inputName: "input1" } },
              },
            },
            Task2: {
              componentRef: {},
              arguments: {
                data: { taskOutput: { taskId: "Task1", outputName: "result" } },
              },
            },
          },
        },
      },
    };

    const spec = deserializer.deserialize(yaml);
    const json = serializer.serialize(spec);
    const graph = getGraph(json);

    expect(graph.tasks["Task1"].arguments).toEqual({
      data: { graphInput: { inputName: "input1" } },
    });
    expect(graph.tasks["Task2"].arguments).toEqual({
      data: { taskOutput: { taskId: "Task1", outputName: "result" } },
    });
  });

  it("literal arguments are preserved", () => {
    const yaml = {
      name: "LiteralTest",
      implementation: {
        graph: {
          tasks: {
            Task1: {
              componentRef: {},
              arguments: {
                stringParam: "hello",
              },
            },
          },
        },
      },
    };

    const spec = deserializer.deserialize(yaml);
    const json = serializer.serialize(spec);

    expect(getGraph(json).tasks["Task1"].arguments).toEqual({
      stringParam: "hello",
    });
  });

  it("preserves executionOptions", () => {
    const yaml = {
      name: "ExecutionOptionsTest",
      implementation: {
        graph: {
          tasks: {
            CachedTask: {
              componentRef: {},
              executionOptions: {
                retryStrategy: { maxRetries: 3 },
                cachingStrategy: { maxCacheStaleness: "P0D" },
              },
            },
          },
        },
      },
    };

    const spec = deserializer.deserialize(yaml);
    const json = serializer.serialize(spec);

    expect(getGraph(json).tasks["CachedTask"].executionOptions).toEqual({
      retryStrategy: { maxRetries: 3 },
      cachingStrategy: { maxCacheStaleness: "P0D" },
    });
  });

  it("omits executionOptions when not present", () => {
    const yaml = {
      name: "NoExecOptions",
      implementation: {
        graph: {
          tasks: {
            SimpleTask: {
              componentRef: {},
            },
          },
        },
      },
    };

    const spec = deserializer.deserialize(yaml);
    const json = serializer.serialize(spec);

    expect(getGraph(json).tasks["SimpleTask"].executionOptions).toBeUndefined();
  });
});
