import { describe, expect, test } from "vitest";

import type { ComponentSpec, TaskSpec } from "@/utils/componentSpec";

import { buildMergedGraph } from "./buildMergedGraph";
import { buildPipelineComparison } from "./comparePipelines";

const task = (digest: string, overrides: Partial<TaskSpec> = {}): TaskSpec => ({
  componentRef: { name: "comp", digest },
  ...overrides,
});

const fromOutput = (taskId: string) => ({
  taskOutput: { taskId, outputName: "out" },
});

const fromInput = (inputName: string) => ({ graphInput: { inputName } });

const ioSpec = (): ComponentSpec => ({
  inputs: [{ name: "data" }],
  outputs: [{ name: "model" }],
  implementation: {
    graph: {
      tasks: {
        train: task("d1", { arguments: { x: fromInput("data") } }),
      },
      outputValues: {
        model: { taskOutput: { taskId: "train", outputName: "out" } },
      },
    },
  },
});

const graphSpec = (tasks: Record<string, TaskSpec>): ComponentSpec => ({
  implementation: { graph: { tasks } },
});

const containerSpec = (): ComponentSpec => ({
  implementation: { container: { image: "python:3.11" } },
});

const noStatus = new Map<string, string>();

const merge = (specA: ComponentSpec, specB: ComponentSpec) =>
  buildMergedGraph(buildPipelineComparison(specA, specB, noStatus, noStatus));

describe("buildMergedGraph()", () => {
  test("unions task ids from both runs into one node each", () => {
    const specA = graphSpec({ train: task("d1"), evaluate: task("d2") });
    const specB = graphSpec({ train: task("d1"), deploy: task("d3") });

    const { nodes } = merge(specA, specB);

    expect(nodes.map((n) => n.id).sort()).toEqual([
      "deploy",
      "evaluate",
      "train",
    ]);
    expect(nodes.every((n) => n.type === "mergedTask")).toBe(true);
  });

  test("marks an edge present in both runs as unchanged", () => {
    const tasks = {
      gen: task("d0"),
      sink: task("d1", { arguments: { x: fromOutput("gen") } }),
    };
    const { edges } = merge(graphSpec(tasks), graphSpec(tasks));

    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({
      source: "gen",
      target: "sink",
      data: { membership: "unchanged" },
    });
  });

  test("marks run-exclusive edges as lost (A-only) and new (B-only)", () => {
    const specA = graphSpec({
      gen: task("d0"),
      sink: task("d1", { arguments: { x: fromOutput("gen") } }),
    });
    const specB = graphSpec({
      gen: task("d0"),
      sink: task("d1"),
      extra: task("d2", { arguments: { y: fromOutput("gen") } }),
    });

    const { edges } = merge(specA, specB);
    const byId = Object.fromEntries(
      edges.map((e) => [e.id, e.data?.membership]),
    );

    expect(byId["gen->sink"]).toBe("lost");
    expect(byId["gen->extra"]).toBe("new");
  });

  test("drops edges that reference an unknown task", () => {
    const specA = graphSpec({
      only: task("d0", { arguments: { x: fromOutput("ghost") } }),
    });

    const { nodes, edges } = merge(specA, specA);

    expect(nodes.map((n) => n.id)).toEqual(["only"]);
    expect(edges).toEqual([]);
  });

  test("produces no nodes for container-implementation specs", () => {
    const { nodes, edges } = merge(containerSpec(), containerSpec());

    expect(nodes).toEqual([]);
    expect(edges).toEqual([]);
  });

  test("adds prefixed nodes for pipeline inputs and outputs", () => {
    const { nodes } = merge(ioSpec(), ioSpec());

    const byId = Object.fromEntries(nodes.map((n) => [n.id, n.type]));
    expect(byId["input:data"]).toBe("mergedIo");
    expect(byId["output:model"]).toBe("mergedIo");
    expect(byId["train"]).toBe("mergedTask");
  });

  test("wires input→task and task→output edges", () => {
    const { edges } = merge(ioSpec(), ioSpec());
    const byId = Object.fromEntries(
      edges.map((e) => [e.id, e.data?.membership]),
    );

    expect(byId["input:data->train"]).toBe("unchanged");
    expect(byId["train->output:model"]).toBe("unchanged");
  });

  test("marks a rewired output edge as run-exclusive", () => {
    const specA = ioSpec();
    const specB: ComponentSpec = {
      inputs: [{ name: "data" }],
      outputs: [{ name: "model" }],
      implementation: {
        graph: {
          tasks: {
            train: task("d1", { arguments: { x: fromInput("data") } }),
            tune: task("d2"),
          },
          outputValues: {
            model: { taskOutput: { taskId: "tune", outputName: "out" } },
          },
        },
      },
    };

    const { edges } = merge(specA, specB);
    const byId = Object.fromEntries(
      edges.map((e) => [e.id, e.data?.membership]),
    );

    expect(byId["train->output:model"]).toBe("lost");
    expect(byId["tune->output:model"]).toBe("new");
  });
});
