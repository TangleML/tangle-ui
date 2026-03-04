import { describe, expect, it } from "vitest";

import type { ComponentSpec, TaskSpec } from "@/utils/componentSpec";

import { compileComponentSpec } from "../compile";
import { decomposeComponentSpec } from "../decompose";

const makeTaskSpec = (overrides?: Partial<TaskSpec>): TaskSpec => ({
  componentRef: { name: "test-component" },
  ...overrides,
});

const makeSubgraphTask = (
  nestedSpec: ComponentSpec,
  overrides?: Partial<TaskSpec>,
): TaskSpec => ({
  componentRef: {
    name: "subgraph-component",
    spec: nestedSpec,
  },
  ...overrides,
});

describe("decompose and compile", () => {
  describe("round-trip", () => {
    it("preserves a simple flat spec", () => {
      const spec: ComponentSpec = {
        name: "my-pipeline",
        description: "A test pipeline",
        inputs: [{ name: "input1", type: "String" }],
        outputs: [{ name: "output1", type: "String" }],
        implementation: {
          graph: {
            tasks: {
              "task-a": makeTaskSpec({
                arguments: { param1: "value1" },
              }),
              "task-b": makeTaskSpec({
                arguments: {
                  data: {
                    taskOutput: {
                      taskId: "task-a",
                      outputName: "result",
                    },
                  },
                },
              }),
            },
            outputValues: {
              output1: {
                taskOutput: {
                  taskId: "task-b",
                  outputName: "result",
                },
              },
            },
          },
        },
        metadata: {
          annotations: {
            author: "test",
          },
        },
      };

      const { graphs } = decomposeComponentSpec(spec);
      const compiled = compileComponentSpec(graphs);

      expect(compiled).toStrictEqual(spec);
    });

    it("preserves a spec with nested subgraphs", () => {
      const innerSubgraph: ComponentSpec = {
        name: "inner-subgraph",
        inputs: [{ name: "inner-in" }],
        outputs: [{ name: "inner-out" }],
        implementation: {
          graph: {
            tasks: {
              "inner-task": makeTaskSpec({
                arguments: {
                  x: { graphInput: { inputName: "inner-in" } },
                },
              }),
            },
            outputValues: {
              "inner-out": {
                taskOutput: {
                  taskId: "inner-task",
                  outputName: "result",
                },
              },
            },
          },
        },
      };

      const outerSubgraph: ComponentSpec = {
        name: "outer-subgraph",
        inputs: [{ name: "outer-in" }],
        outputs: [{ name: "outer-out" }],
        implementation: {
          graph: {
            tasks: {
              "outer-task": makeTaskSpec(),
              "nested-graph": makeSubgraphTask(innerSubgraph),
            },
          },
        },
      };

      const rootSpec: ComponentSpec = {
        name: "root-pipeline",
        implementation: {
          graph: {
            tasks: {
              "root-task-1": makeTaskSpec(),
              "root-subgraph": makeSubgraphTask(outerSubgraph),
            },
          },
        },
      };

      const { graphs } = decomposeComponentSpec(rootSpec);
      const compiled = compileComponentSpec(graphs);

      expect(compiled).toStrictEqual(rootSpec);
    });

    it("preserves a minimal empty spec", () => {
      const spec: ComponentSpec = {
        implementation: {
          graph: {
            tasks: {},
          },
        },
      };

      const { graphs } = decomposeComponentSpec(spec);
      const compiled = compileComponentSpec(graphs);

      expect(compiled).toStrictEqual(spec);
    });

    it("preserves task annotations and execution options", () => {
      const spec: ComponentSpec = {
        name: "annotated-pipeline",
        implementation: {
          graph: {
            tasks: {
              "task-1": makeTaskSpec({
                annotations: {
                  "pipelines.kubeflow.org/position": '{"x":100,"y":200}',
                  display_name: "My Task",
                },
                executionOptions: {
                  retryStrategy: { maxRetries: 3 },
                  cachingStrategy: { maxCacheStaleness: "P30D" },
                },
              }),
            },
          },
        },
      };

      const { graphs } = decomposeComponentSpec(spec);
      const compiled = compileComponentSpec(graphs);

      expect(compiled).toStrictEqual(spec);
    });
  });

  describe("decompose", () => {
    it("creates one graph entry for a flat spec", () => {
      const spec: ComponentSpec = {
        implementation: {
          graph: {
            tasks: {
              "task-a": makeTaskSpec(),
              "task-b": makeTaskSpec(),
            },
          },
        },
      };

      const { graphs } = decomposeComponentSpec(spec);

      expect(Object.keys(graphs)).toEqual(["root"]);
      expect(Object.keys(graphs["root"].tasks)).toEqual(["task-a", "task-b"]);
    });

    it("creates separate entries for nested subgraphs", () => {
      const nestedSpec: ComponentSpec = {
        name: "nested",
        implementation: {
          graph: {
            tasks: {
              "nested-task": makeTaskSpec(),
            },
          },
        },
      };

      const spec: ComponentSpec = {
        implementation: {
          graph: {
            tasks: {
              "regular-task": makeTaskSpec(),
              "subgraph-task": makeSubgraphTask(nestedSpec),
            },
          },
        },
      };

      const { graphs } = decomposeComponentSpec(spec);

      expect(Object.keys(graphs).sort()).toEqual([
        "root",
        "root>subgraph-task",
      ]);
      expect(Object.keys(graphs["root"].tasks)).toEqual([
        "regular-task",
        "subgraph-task",
      ]);
      expect(Object.keys(graphs["root>subgraph-task"].tasks)).toEqual([
        "nested-task",
      ]);
    });

    it("decomposes deeply nested subgraphs", () => {
      const level2: ComponentSpec = {
        implementation: {
          graph: {
            tasks: { "deep-task": makeTaskSpec() },
          },
        },
      };

      const level1: ComponentSpec = {
        implementation: {
          graph: {
            tasks: { "mid-task": makeSubgraphTask(level2) },
          },
        },
      };

      const root: ComponentSpec = {
        implementation: {
          graph: {
            tasks: { "top-task": makeSubgraphTask(level1) },
          },
        },
      };

      const { graphs } = decomposeComponentSpec(root);

      expect(Object.keys(graphs).sort()).toEqual([
        "root",
        "root>top-task",
        "root>top-task>mid-task",
      ]);
    });

    it("preserves graph-level metadata for nested specs", () => {
      const nested: ComponentSpec = {
        name: "nested-name",
        description: "nested desc",
        inputs: [{ name: "n-in" }],
        outputs: [{ name: "n-out" }],
        implementation: {
          graph: { tasks: { t: makeTaskSpec() } },
        },
      };

      const root: ComponentSpec = {
        name: "root-name",
        implementation: {
          graph: {
            tasks: { sub: makeSubgraphTask(nested) },
          },
        },
      };

      const { graphs } = decomposeComponentSpec(root);

      expect(graphs["root"].name).toBe("root-name");
      expect(graphs["root>sub"].name).toBe("nested-name");
      expect(graphs["root>sub"].description).toBe("nested desc");
      expect(graphs["root>sub"].inputs).toEqual([{ name: "n-in" }]);
      expect(graphs["root>sub"].outputs).toEqual([{ name: "n-out" }]);
    });
  });

  describe("compile", () => {
    it("throws for missing graph entry", () => {
      expect(() => compileComponentSpec({}, ["root"])).toThrow(
        "No graph found for path: root",
      );
    });

    it("compiles a flat graph correctly", () => {
      const graphs = {
        root: {
          name: "test",
          tasks: {
            "task-a": makeTaskSpec({ arguments: { x: "1" } }),
          },
        },
      };

      const spec = compileComponentSpec(graphs);

      expect(spec.name).toBe("test");
      expect(spec.implementation).toEqual({
        graph: {
          tasks: {
            "task-a": makeTaskSpec({ arguments: { x: "1" } }),
          },
        },
      });
    });

    it("embeds nested subgraph specs back into componentRef", () => {
      const graphs = {
        root: {
          tasks: {
            "sub-task": makeSubgraphTask({
              implementation: { graph: { tasks: {} } },
            }),
          },
        },
        "root>sub-task": {
          name: "nested-pipeline",
          inputs: [{ name: "in1" }],
          tasks: {
            "inner-task": makeTaskSpec(),
          },
        },
      };

      const spec = compileComponentSpec(graphs);
      const subTask = spec.implementation as {
        graph: { tasks: Record<string, TaskSpec> };
      };
      const nestedSpec = subTask.graph.tasks["sub-task"].componentRef.spec;

      expect(nestedSpec).toBeDefined();
      expect(nestedSpec!.name).toBe("nested-pipeline");
      expect(nestedSpec!.inputs).toEqual([{ name: "in1" }]);
      expect(
        (
          nestedSpec!.implementation as {
            graph: { tasks: Record<string, TaskSpec> };
          }
        ).graph.tasks["inner-task"],
      ).toEqual(makeTaskSpec());
    });
  });
});
