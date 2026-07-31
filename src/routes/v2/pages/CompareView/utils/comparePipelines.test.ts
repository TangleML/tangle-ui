import { describe, expect, test } from "vitest";

import type { ComponentSpec, TaskSpec } from "@/utils/componentSpec";

import { buildPipelineComparison } from "./comparePipelines";

const task = (digest: string, overrides: Partial<TaskSpec> = {}): TaskSpec => ({
  componentRef: { name: "comp", digest },
  ...overrides,
});

const graphSpec = (tasks: Record<string, TaskSpec>): ComponentSpec => ({
  implementation: { graph: { tasks } },
});

const containerSpec = (): ComponentSpec => ({
  implementation: { container: { image: "python:3.11" } },
});

const noStatus = new Map<string, string>();

describe("buildPipelineComparison()", () => {
  test("flags added, removed, and unchanged tasks by id", () => {
    const specA = graphSpec({ train: task("d1"), evaluate: task("d2") });
    const specB = graphSpec({ train: task("d1"), deploy: task("d3") });

    const { taskDiffs, counts } = buildPipelineComparison(
      specA,
      specB,
      noStatus,
      noStatus,
    );

    const byId = Object.fromEntries(taskDiffs.map((d) => [d.taskId, d.status]));
    expect(byId).toEqual({
      train: "unchanged",
      evaluate: "lost",
      deploy: "new",
    });
    expect(counts).toEqual({
      added: 1,
      removed: 1,
      changed: 0,
      unchanged: 1,
      outcomeChanged: 0,
    });
  });

  test("marks a task changed when the component digest differs", () => {
    const specA = graphSpec({ train: task("d1") });
    const specB = graphSpec({ train: task("d2") });

    const [diff] = buildPipelineComparison(
      specA,
      specB,
      noStatus,
      noStatus,
    ).taskDiffs;

    expect(diff.status).toBe("changed");
    expect(diff.sameComponentVersion).toBe(false);
  });

  test("marks a task changed when arguments differ but the component is identical", () => {
    const specA = graphSpec({
      train: task("d1", { arguments: { epochs: "10" } }),
    });
    const specB = graphSpec({
      train: task("d1", { arguments: { epochs: "20" } }),
    });

    const [diff] = buildPipelineComparison(
      specA,
      specB,
      noStatus,
      noStatus,
    ).taskDiffs;

    expect(diff.status).toBe("changed");
    expect(diff.sameComponentVersion).toBe(true);
    const epochs = diff.argumentDiffs.find((a) => a.key === "epochs");
    expect(epochs?.status).toBe("changed");
  });

  test("ignores frontend-only annotation changes", () => {
    const specA = graphSpec({
      train: task("d1", {
        annotations: { "editor.position": "{x:0}", zIndex: "1" },
      }),
    });
    const specB = graphSpec({
      train: task("d1", {
        annotations: { "editor.position": "{x:999}", zIndex: "5" },
      }),
    });

    const [diff] = buildPipelineComparison(
      specA,
      specB,
      noStatus,
      noStatus,
    ).taskDiffs;

    expect(diff.status).toBe("unchanged");
    expect(
      diff.annotationDiffs.some((entry) => entry.status !== "unchanged"),
    ).toBe(false);
  });

  test("flags a cache-only change as changed and carries per-run cache state", () => {
    const specA = graphSpec({
      train: task("d1", {
        executionOptions: { cachingStrategy: { maxCacheStaleness: "P0D" } },
      }),
    });
    const specB = graphSpec({ train: task("d1") });

    const [diff] = buildPipelineComparison(
      specA,
      specB,
      noStatus,
      noStatus,
    ).taskDiffs;

    expect(diff.status).toBe("changed");
    expect(diff.cacheChanged).toBe(true);
    expect(diff.cacheDisabledA).toBe(true);
    expect(diff.cacheDisabledB).toBe(false);
  });

  test("treats structurally equal object arguments as unchanged", () => {
    const arg = { taskOutput: { taskId: "prep", outputName: "data" } };
    const specA = graphSpec({ train: task("d1", { arguments: { in: arg } }) });
    const specB = graphSpec({
      train: task("d1", { arguments: { in: { ...arg } } }),
    });

    const [diff] = buildPipelineComparison(
      specA,
      specB,
      noStatus,
      noStatus,
    ).taskDiffs;

    expect(diff.status).toBe("unchanged");
  });

  test("carries per-run execution status onto each task diff", () => {
    const specA = graphSpec({ train: task("d1") });
    const specB = graphSpec({ train: task("d1") });

    const [diff] = buildPipelineComparison(
      specA,
      specB,
      new Map([["train", "SUCCEEDED"]]),
      new Map([["train", "FAILED"]]),
    ).taskDiffs;

    expect(diff.statusA).toBe("SUCCEEDED");
    expect(diff.statusB).toBe("FAILED");
  });

  test("carries per-run execution ids onto each task diff", () => {
    const specA = graphSpec({ train: task("d1") });
    const specB = graphSpec({ train: task("d1") });

    const [diff] = buildPipelineComparison(
      specA,
      specB,
      noStatus,
      noStatus,
      new Map([["train", "exec-a"]]),
      new Map([["train", "exec-b"]]),
    ).taskDiffs;

    expect(diff.executionIdA).toBe("exec-a");
    expect(diff.executionIdB).toBe("exec-b");
  });

  test("flags an outcome difference even when the task spec is unchanged", () => {
    const specA = graphSpec({ train: task("d1") });
    const specB = graphSpec({ train: task("d1") });

    const { taskDiffs, counts } = buildPipelineComparison(
      specA,
      specB,
      new Map([["train", "SUCCEEDED"]]),
      new Map([["train", "FAILED"]]),
    );

    expect(taskDiffs[0].status).toBe("unchanged");
    expect(taskDiffs[0].outcomeChanged).toBe(true);
    expect(counts.outcomeChanged).toBe(1);
  });

  test("does not flag an outcome difference when both runs share a status", () => {
    const specA = graphSpec({ train: task("d1") });
    const specB = graphSpec({ train: task("d1") });

    const { taskDiffs, counts } = buildPipelineComparison(
      specA,
      specB,
      new Map([["train", "SUCCEEDED"]]),
      new Map([["train", "SUCCEEDED"]]),
    );

    expect(taskDiffs[0].outcomeChanged).toBe(false);
    expect(counts.outcomeChanged).toBe(0);
  });

  test("reports no comparable tasks for container-implementation specs", () => {
    const { taskDiffs, hasComparableTasks } = buildPipelineComparison(
      containerSpec(),
      containerSpec(),
      noStatus,
      noStatus,
    );

    expect(taskDiffs).toHaveLength(0);
    expect(hasComparableTasks).toBe(false);
  });

  test("treats unrelated pipelines as fully added/removed", () => {
    const specA = graphSpec({ a1: task("d1"), a2: task("d2") });
    const specB = graphSpec({ b1: task("d3") });

    const { counts } = buildPipelineComparison(
      specA,
      specB,
      noStatus,
      noStatus,
    );

    expect(counts).toEqual({
      added: 1,
      removed: 2,
      changed: 0,
      unchanged: 0,
      outcomeChanged: 0,
    });
  });

  test("aligns pipeline inputs by name and flags value changes", () => {
    const specA: ComponentSpec = {
      inputs: [{ name: "epochs", value: "10" }, { name: "dropped" }],
      implementation: { graph: { tasks: {} } },
    };
    const specB: ComponentSpec = {
      inputs: [{ name: "epochs", value: "20" }, { name: "added" }],
      implementation: { graph: { tasks: {} } },
    };

    const { inputDiffs } = buildPipelineComparison(
      specA,
      specB,
      noStatus,
      noStatus,
    );
    const byName = Object.fromEntries(
      inputDiffs.map((d) => [d.name, d.status]),
    );

    expect(byName).toEqual({
      epochs: "changed",
      dropped: "lost",
      added: "new",
    });
    const epochs = inputDiffs.find((d) => d.name === "epochs");
    expect(epochs?.fieldDiffs.find((f) => f.key === "value")?.status).toBe(
      "changed",
    );
  });

  test("flags an output whose producing task was rewired", () => {
    const specA: ComponentSpec = {
      outputs: [{ name: "model" }],
      implementation: {
        graph: {
          tasks: { train: task("d1"), tune: task("d2") },
          outputValues: {
            model: { taskOutput: { taskId: "train", outputName: "out" } },
          },
        },
      },
    };
    const specB: ComponentSpec = {
      outputs: [{ name: "model" }],
      implementation: {
        graph: {
          tasks: { train: task("d1"), tune: task("d2") },
          outputValues: {
            model: { taskOutput: { taskId: "tune", outputName: "out" } },
          },
        },
      },
    };

    const { outputDiffs } = buildPipelineComparison(
      specA,
      specB,
      noStatus,
      noStatus,
    );

    const model = outputDiffs.find((d) => d.name === "model");
    expect(model?.status).toBe("changed");
    expect(model?.sourceTaskIdA).toBe("train");
    expect(model?.sourceTaskIdB).toBe("tune");
    expect(model?.fieldDiffs.find((f) => f.key === "source")?.status).toBe(
      "changed",
    );
  });
});
