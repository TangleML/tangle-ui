import { beforeEach, describe, expect, it } from "vitest";

import { IncrementingIdGenerator } from "../../factories/idGenerator";
import { YamlDeserializer } from "../../serialization/yamlDeserializer";

describe("YamlDeserializer", () => {
  let deserializer: YamlDeserializer;

  beforeEach(() => {
    deserializer = new YamlDeserializer(new IncrementingIdGenerator());
  });

  it("deserializes minimal spec", () => {
    const yaml = { name: "SimpleSpec" };

    const spec = deserializer.deserialize(yaml);

    expect(spec.name).toBe("SimpleSpec");
    expect(spec.tasks.length).toBe(0);
  });

  it("deserializes spec with description", () => {
    const yaml = { name: "TestSpec", description: "A test specification" };

    const spec = deserializer.deserialize(yaml);

    expect(spec.description).toBe("A test specification");
  });

  it("deserializes spec with inputs", () => {
    const yaml = {
      name: "SpecWithInputs",
      inputs: [
        { name: "data", type: "string" },
        { name: "config", type: "object", optional: true },
      ],
    };

    const spec = deserializer.deserialize(yaml);

    expect(spec.inputs.length).toBe(2);
    expect(spec.inputs.at(0)?.name).toBe("data");
    expect(spec.inputs.at(0)?.type).toBe("string");
    expect(spec.inputs.at(1)?.name).toBe("config");
    expect(spec.inputs.at(1)?.optional).toBe(true);
  });

  it("deserializes input with default value", () => {
    const yaml = {
      name: "Spec",
      inputs: [{ name: "data", default: "default_value" }],
    };

    const spec = deserializer.deserialize(yaml);

    expect(spec.inputs.at(0)?.defaultValue).toBe("default_value");
  });

  it("deserializes spec with outputs", () => {
    const yaml = {
      name: "SpecWithOutputs",
      outputs: [{ name: "result", type: "string", description: "The result" }],
    };

    const spec = deserializer.deserialize(yaml);

    expect(spec.outputs.length).toBe(1);
    expect(spec.outputs.at(0)?.name).toBe("result");
    expect(spec.outputs.at(0)?.type).toBe("string");
    expect(spec.outputs.at(0)?.description).toBe("The result");
  });

  it("deserializes spec with tasks", () => {
    const yaml = {
      name: "Pipeline",
      implementation: {
        graph: {
          tasks: {
            ProcessTask: {
              componentRef: { name: "Processor" },
            },
          },
        },
      },
    };

    const spec = deserializer.deserialize(yaml);

    expect(spec.tasks.length).toBe(1);
    expect(spec.tasks.at(0)?.name).toBe("ProcessTask");
    expect(spec.tasks.at(0)?.componentRef).toEqual({ name: "Processor" });
  });

  it("deserializes task with isEnabled", () => {
    const yaml = {
      name: "Pipeline",
      implementation: {
        graph: {
          tasks: {
            ConditionalTask: {
              componentRef: {},
              isEnabled: { "==": { op1: "a", op2: "b" } },
            },
          },
        },
      },
    };

    const spec = deserializer.deserialize(yaml);

    expect(spec.tasks.at(0)?.isEnabled).toEqual({
      "==": { op1: "a", op2: "b" },
    });
  });

  it("deserializes task annotations", () => {
    const yaml = {
      name: "Pipeline",
      implementation: {
        graph: {
          tasks: {
            Task1: {
              componentRef: {},
              annotations: { note: "important", priority: 1 },
            },
          },
        },
      },
    };

    const spec = deserializer.deserialize(yaml);

    const task = spec.tasks.at(0);
    expect(task?.annotations.length).toBe(2);
    expect(task?.annotations.find((a) => a.key === "note")?.value).toBe(
      "important",
    );
    expect(task?.annotations.find((a) => a.key === "priority")?.value).toBe(1);
  });

  it("deserializes bindings from string template (graphInput)", () => {
    const yaml = {
      name: "Pipeline",
      inputs: [{ name: "input_data" }],
      implementation: {
        graph: {
          tasks: {
            ProcessTask: {
              componentRef: { name: "Processor" },
              arguments: { data: "{{inputs.input_data}}" },
            },
          },
        },
      },
    };

    const spec = deserializer.deserialize(yaml);

    expect(spec.bindings.length).toBe(1);
    const binding = spec.bindings.at(0);
    expect(binding?.sourcePortName).toBe("input_data");
    expect(binding?.targetPortName).toBe("data");
  });

  it("deserializes bindings from string template (taskOutput)", () => {
    const yaml = {
      name: "Pipeline",
      implementation: {
        graph: {
          tasks: {
            Task1: { componentRef: {} },
            Task2: {
              componentRef: {},
              arguments: { data: "{{tasks.Task1.outputs.result}}" },
            },
          },
        },
      },
    };

    const spec = deserializer.deserialize(yaml);

    expect(spec.bindings.length).toBe(1);
    const binding = spec.bindings.at(0);
    expect(binding?.sourcePortName).toBe("result");
    expect(binding?.targetPortName).toBe("data");
  });

  it("deserializes bindings from object format (graphInput)", () => {
    const yaml = {
      name: "Pipeline",
      inputs: [{ name: "input_data" }],
      implementation: {
        graph: {
          tasks: {
            ProcessTask: {
              componentRef: {},
              arguments: {
                data: { graphInput: { inputName: "input_data" } },
              },
            },
          },
        },
      },
    };

    const spec = deserializer.deserialize(yaml);

    expect(spec.bindings.length).toBe(1);
    const binding = spec.bindings.at(0);
    expect(binding?.sourcePortName).toBe("input_data");
    expect(binding?.targetPortName).toBe("data");
  });

  it("deserializes bindings from object format (taskOutput)", () => {
    const yaml = {
      name: "Pipeline",
      implementation: {
        graph: {
          tasks: {
            Task1: { componentRef: {} },
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

    expect(spec.bindings.length).toBe(1);
  });

  it("deserializes outputValues bindings", () => {
    const yaml = {
      name: "Pipeline",
      outputs: [{ name: "result" }],
      implementation: {
        graph: {
          tasks: {
            Task1: { componentRef: {} },
          },
          outputValues: {
            result: { taskOutput: { taskId: "Task1", outputName: "output" } },
          },
        },
      },
    };

    const spec = deserializer.deserialize(yaml);

    const outputBindings = spec.bindings.filter(
      (b) => b.targetEntityId === spec.outputs.at(0)?.$id,
    );
    expect(outputBindings.length).toBe(1);
  });

  it("deserializes metadata as annotations", () => {
    const yaml = {
      name: "SpecWithMetadata",
      metadata: { author: "Jane", version: "2.0" },
    };

    const spec = deserializer.deserialize(yaml);

    expect(spec.getMetadata("author")).toBe("Jane");
    expect(spec.getMetadata("version")).toBe("2.0");
  });

  it("handles spec without implementation", () => {
    const yaml = { name: "NoImpl" };

    const spec = deserializer.deserialize(yaml);

    expect(spec.tasks.length).toBe(0);
    expect(spec.bindings.length).toBe(0);
  });

  it("deserializes literal argument values", () => {
    const yaml = {
      name: "Pipeline",
      implementation: {
        graph: {
          tasks: {
            Task1: {
              componentRef: {},
              arguments: { param: "literal_value" },
            },
          },
        },
      },
    };

    const spec = deserializer.deserialize(yaml);

    const task = spec.tasks.at(0);
    expect(task?.arguments.length).toBe(1);
    expect(task?.arguments.at(0)?.name).toBe("param");
    expect(task?.arguments.at(0)?.value).toBe("literal_value");
  });
});
