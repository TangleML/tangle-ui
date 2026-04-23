import { describe, expect, it } from "vitest";

import {
  IncrementingIdGenerator,
  ReplayIdGenerator,
} from "../../factories/idGenerator";
import { collectIdStack } from "../../serialization/collectIdStack";
import { YamlDeserializer } from "../../serialization/yamlDeserializer";

const COMPLEX_YAML = {
  name: "ComplexPipeline",
  inputs: [{ name: "raw_data" }, { name: "config", type: "object" }],
  outputs: [{ name: "processed" }, { name: "report" }],
  implementation: {
    graph: {
      tasks: {
        Validate: {
          componentRef: { name: "Validator" },
          arguments: { data: "{{inputs.raw_data}}" },
        },
        Transform: {
          componentRef: { name: "Transformer" },
          arguments: {
            data: {
              taskOutput: { taskId: "Validate", outputName: "validated" },
            },
            config: { graphInput: { inputName: "config" } },
          },
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
        report: {
          taskOutput: { taskId: "Transform", outputName: "log" },
        },
      },
    },
  },
};

const SUBGRAPH_YAML = {
  name: "PipelineWithSubgraph",
  inputs: [{ name: "data" }],
  outputs: [{ name: "result" }],
  implementation: {
    graph: {
      tasks: {
        Preprocess: {
          componentRef: { name: "Preprocessor" },
          arguments: { input: "{{inputs.data}}" },
        },
        SubgraphTask: {
          componentRef: {
            spec: {
              name: "InnerPipeline",
              inputs: [{ name: "inner_in" }],
              outputs: [{ name: "inner_out" }],
              implementation: {
                graph: {
                  tasks: {
                    InnerStep: {
                      componentRef: { name: "InnerComponent" },
                      arguments: {
                        x: { graphInput: { inputName: "inner_in" } },
                      },
                    },
                  },
                  outputValues: {
                    inner_out: {
                      taskOutput: {
                        taskId: "InnerStep",
                        outputName: "out",
                      },
                    },
                  },
                },
              },
            },
          },
          arguments: {
            inner_in: {
              taskOutput: {
                taskId: "Preprocess",
                outputName: "preprocessed",
              },
            },
          },
        },
      },
      outputValues: {
        result: {
          taskOutput: { taskId: "SubgraphTask", outputName: "inner_out" },
        },
      },
    },
  },
};

describe("ReplayIdGenerator", () => {
  it("replays IDs from the stack in order", () => {
    const stack = ["id_a", "id_b", "id_c"];
    const gen = new ReplayIdGenerator(stack);

    expect(gen.next()).toBe("id_a");
    expect(gen.next()).toBe("id_b");
    expect(gen.next()).toBe("id_c");
  });

  it("falls back to random IDs when stack is exhausted", () => {
    const stack = ["id_a"];
    const gen = new ReplayIdGenerator(stack);

    expect(gen.next()).toBe("id_a");
    const fallbackId = gen.next("task");
    expect(fallbackId).toMatch(/^task_/);
  });

  it("tracks consumed count", () => {
    const stack = ["id_a", "id_b"];
    const gen = new ReplayIdGenerator(stack);

    expect(gen.consumed).toBe(0);
    gen.next();
    expect(gen.consumed).toBe(1);
    gen.next();
    expect(gen.consumed).toBe(2);
  });

  it("reports exhaustion status", () => {
    const stack = ["id_a"];
    const gen = new ReplayIdGenerator(stack);

    expect(gen.isExhausted).toBe(false);
    gen.next();
    expect(gen.isExhausted).toBe(true);
  });
});

describe("collectIdStack", () => {
  it("collects IDs in deserialization order: inputs, outputs, tasks, bindings, spec", () => {
    const idGen = new IncrementingIdGenerator();
    const deserializer = new YamlDeserializer(idGen);
    const spec = deserializer.deserialize(COMPLEX_YAML);

    const ids = collectIdStack(spec);

    let idx = 0;
    for (const input of spec.inputs) {
      expect(ids[idx]).toBe(input.$id);
      idx++;
    }
    for (const output of spec.outputs) {
      expect(ids[idx]).toBe(output.$id);
      idx++;
    }
    for (const task of spec.tasks) {
      expect(ids[idx]).toBe(task.$id);
      idx++;
    }
    for (const binding of spec.bindings) {
      expect(ids[idx]).toBe(binding.$id);
      idx++;
    }

    expect(ids[idx]).toBe(spec.$id);
    idx++;

    expect(ids.length).toBe(idx);
  });

  it("returns single ID for minimal spec", () => {
    const idGen = new IncrementingIdGenerator();
    const deserializer = new YamlDeserializer(idGen);
    const spec = deserializer.deserialize({ name: "Empty" });

    const ids = collectIdStack(spec);
    expect(ids).toHaveLength(1);
    expect(ids[0]).toBe(spec.$id);
  });

  it("includes subgraph entity IDs before the parent task ID", () => {
    const idGen = new IncrementingIdGenerator();
    const deserializer = new YamlDeserializer(idGen);
    const spec = deserializer.deserialize(SUBGRAPH_YAML);

    const ids = collectIdStack(spec);

    const subgraphTask = spec.tasks.find((t) => t.subgraphSpec !== undefined);
    expect(subgraphTask).toBeDefined();

    const subgraphSpec = subgraphTask!.subgraphSpec!;
    const parentTaskIdx = ids.indexOf(subgraphTask!.$id);
    const subgraphSpecIdx = ids.indexOf(subgraphSpec.$id);

    expect(subgraphSpecIdx).toBeLessThan(parentTaskIdx);

    for (const input of subgraphSpec.inputs) {
      expect(ids.indexOf(input.$id)).toBeLessThan(parentTaskIdx);
    }
    for (const task of subgraphSpec.tasks) {
      expect(ids.indexOf(task.$id)).toBeLessThan(parentTaskIdx);
    }
    for (const binding of subgraphSpec.bindings) {
      expect(ids.indexOf(binding.$id)).toBeLessThan(parentTaskIdx);
    }
  });
});

describe("ID Replay round-trip", () => {
  it("produces identical IDs when replaying from collected stack", () => {
    const idGen1 = new IncrementingIdGenerator();
    const deserializer1 = new YamlDeserializer(idGen1);
    const spec1 = deserializer1.deserialize(COMPLEX_YAML);
    const idStack = collectIdStack(spec1);

    const replayGen = new ReplayIdGenerator(idStack);
    const deserializer2 = new YamlDeserializer(replayGen);
    const spec2 = deserializer2.deserialize(COMPLEX_YAML);

    expect(spec2.$id).toBe(spec1.$id);

    for (let i = 0; i < spec1.inputs.length; i++) {
      expect(spec2.inputs[i].$id).toBe(spec1.inputs[i].$id);
    }
    for (let i = 0; i < spec1.outputs.length; i++) {
      expect(spec2.outputs[i].$id).toBe(spec1.outputs[i].$id);
    }
    for (let i = 0; i < spec1.tasks.length; i++) {
      expect(spec2.tasks[i].$id).toBe(spec1.tasks[i].$id);
    }
    for (let i = 0; i < spec1.bindings.length; i++) {
      expect(spec2.bindings[i].$id).toBe(spec1.bindings[i].$id);
    }

    expect(replayGen.isExhausted).toBe(true);
  });

  it("produces identical IDs for spec with all binding types", () => {
    const yaml = {
      name: "AllBindingTypes",
      inputs: [{ name: "in1" }],
      outputs: [{ name: "out1" }],
      implementation: {
        graph: {
          tasks: {
            A: {
              componentRef: {},
              arguments: {
                fromInput: "{{inputs.in1}}",
              },
            },
            B: {
              componentRef: {},
              arguments: {
                fromTask: "{{tasks.A.outputs.result}}",
                fromInputObj: { graphInput: { inputName: "in1" } },
              },
            },
            C: {
              componentRef: {},
              arguments: {
                fromTaskObj: {
                  taskOutput: { taskId: "A", outputName: "other" },
                },
              },
            },
          },
          outputValues: {
            out1: { taskOutput: { taskId: "C", outputName: "final" } },
          },
        },
      },
    };

    const idGen1 = new IncrementingIdGenerator();
    const spec1 = new YamlDeserializer(idGen1).deserialize(yaml);
    const idStack = collectIdStack(spec1);

    const spec2 = new YamlDeserializer(
      new ReplayIdGenerator(idStack),
    ).deserialize(yaml);

    expect(spec2.$id).toBe(spec1.$id);
    expect(spec2.bindings.length).toBe(spec1.bindings.length);

    for (let i = 0; i < spec1.bindings.length; i++) {
      expect(spec2.bindings[i].$id).toBe(spec1.bindings[i].$id);
      expect(spec2.bindings[i].sourceEntityId).toBe(
        spec1.bindings[i].sourceEntityId,
      );
      expect(spec2.bindings[i].targetEntityId).toBe(
        spec1.bindings[i].targetEntityId,
      );
    }
  });

  it("produces identical IDs when replaying a spec with subgraphs", () => {
    const idGen1 = new IncrementingIdGenerator();
    const spec1 = new YamlDeserializer(idGen1).deserialize(SUBGRAPH_YAML);
    const idStack = collectIdStack(spec1);

    const replayGen = new ReplayIdGenerator(idStack);
    const spec2 = new YamlDeserializer(replayGen).deserialize(SUBGRAPH_YAML);

    expect(spec2.$id).toBe(spec1.$id);

    for (let i = 0; i < spec1.inputs.length; i++) {
      expect(spec2.inputs[i].$id).toBe(spec1.inputs[i].$id);
    }
    for (let i = 0; i < spec1.outputs.length; i++) {
      expect(spec2.outputs[i].$id).toBe(spec1.outputs[i].$id);
    }
    for (let i = 0; i < spec1.tasks.length; i++) {
      expect(spec2.tasks[i].$id).toBe(spec1.tasks[i].$id);

      const sub1 = spec1.tasks[i].subgraphSpec;
      const sub2 = spec2.tasks[i].subgraphSpec;
      if (sub1 && sub2) {
        expect(sub2.$id).toBe(sub1.$id);
        for (let j = 0; j < sub1.tasks.length; j++) {
          expect(sub2.tasks[j].$id).toBe(sub1.tasks[j].$id);
        }
        for (let j = 0; j < sub1.inputs.length; j++) {
          expect(sub2.inputs[j].$id).toBe(sub1.inputs[j].$id);
        }
        for (let j = 0; j < sub1.bindings.length; j++) {
          expect(sub2.bindings[j].$id).toBe(sub1.bindings[j].$id);
        }
      }
    }
    for (let i = 0; i < spec1.bindings.length; i++) {
      expect(spec2.bindings[i].$id).toBe(spec1.bindings[i].$id);
    }

    expect(replayGen.isExhausted).toBe(true);
  });

  it("preserves correct ID prefixes for subgraph entities after replay", () => {
    const idGen1 = new IncrementingIdGenerator();
    const spec1 = new YamlDeserializer(idGen1).deserialize(SUBGRAPH_YAML);
    const idStack = collectIdStack(spec1);

    const spec2 = new YamlDeserializer(
      new ReplayIdGenerator(idStack),
    ).deserialize(SUBGRAPH_YAML);

    for (const task of spec2.tasks) {
      expect(task.$id).toMatch(/^task_/);
      if (task.subgraphSpec) {
        expect(task.subgraphSpec.$id).toMatch(/^spec_/);
        for (const innerTask of task.subgraphSpec.tasks) {
          expect(innerTask.$id).toMatch(/^task_/);
        }
        for (const innerInput of task.subgraphSpec.inputs) {
          expect(innerInput.$id).toMatch(/^input_/);
        }
        for (const innerOutput of task.subgraphSpec.outputs) {
          expect(innerOutput.$id).toMatch(/^output_/);
        }
        for (const innerBinding of task.subgraphSpec.bindings) {
          expect(innerBinding.$id).toMatch(/^binding_/);
        }
      }
    }
  });

  it("produces different IDs without replay", () => {
    const idGen1 = new IncrementingIdGenerator();
    const spec1 = new YamlDeserializer(idGen1).deserialize(COMPLEX_YAML);

    const idGen2 = new IncrementingIdGenerator();
    const spec2 = new YamlDeserializer(idGen2).deserialize(COMPLEX_YAML);

    expect(spec2.$id).not.toBe(spec1.$id);
  });
});
