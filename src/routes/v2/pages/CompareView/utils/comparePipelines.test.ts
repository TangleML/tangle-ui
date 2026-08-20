import { describe, expect, test } from "vitest";

import type {
  ArtifactDataResponse,
  ArtifactNodeResponse,
} from "@/api/types.gen";
import type {
  ArgumentType,
  ComponentSpec,
  TaskSpec,
} from "@/utils/componentSpec";

import {
  buildPipelineComparison,
  type ComparisonSide,
  ioDisplayStatus,
} from "./comparePipelines";

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

const enabledByFlag: ArgumentType = {
  taskOutput: { taskId: "prep", outputName: "should_train" },
};

const side = (
  spec: ComponentSpec | undefined,
  taskStatusMap: Map<string, string> = noStatus,
  taskExecutionIdMap?: Map<string, string>,
): ComparisonSide => ({ spec, taskStatusMap, taskExecutionIdMap });

const outputSpec = (): ComponentSpec => ({
  outputs: [{ name: "model" }],
  implementation: {
    graph: {
      tasks: { train: task("d1") },
      outputValues: {
        model: { taskOutput: { taskId: "train", outputName: "out" } },
      },
    },
  },
});

const ioGraphSpec = (): ComponentSpec => ({
  ...outputSpec(),
  inputs: [{ name: "api_key" }],
});

const artifact = (
  id: string,
  data: Partial<ArtifactDataResponse>,
): ArtifactNodeResponse => ({
  id,
  artifact_data: { total_size: 0, is_dir: false, ...data },
});

const sideWithArtifacts = (
  spec: ComponentSpec,
  outputArtifacts: Record<string, ArtifactNodeResponse>,
): ComparisonSide => ({ spec, taskStatusMap: noStatus, outputArtifacts });

describe("buildPipelineComparison()", () => {
  test("flags added, removed, and unchanged tasks by id", () => {
    const specA = graphSpec({ train: task("d1"), evaluate: task("d2") });
    const specB = graphSpec({ train: task("d1"), deploy: task("d3") });

    const { taskDiffs, counts } = buildPipelineComparison(
      side(specA),
      side(specB),
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
      outputArtifactChanged: 0,
    });
  });

  test("marks a task changed when the component digest differs", () => {
    const specA = graphSpec({ train: task("d1") });
    const specB = graphSpec({ train: task("d2") });

    const [diff] = buildPipelineComparison(side(specA), side(specB)).taskDiffs;

    expect(diff.status).toBe("changed");
    expect(diff.componentChanged).toBe(true);
  });

  test("marks a task changed when arguments differ but the component is identical", () => {
    const specA = graphSpec({
      train: task("d1", { arguments: { epochs: "10" } }),
    });
    const specB = graphSpec({
      train: task("d1", { arguments: { epochs: "20" } }),
    });

    const [diff] = buildPipelineComparison(side(specA), side(specB)).taskDiffs;

    expect(diff.status).toBe("changed");
    expect(diff.componentChanged).toBe(false);
    const epochs = diff.argumentDiffs.find((a) => a.key === "epochs");
    expect(epochs?.status).toBe("changed");
  });

  test("does not claim a component change when digests are absent and the refs match", () => {
    const digestless = (args: Record<string, string>): TaskSpec => ({
      componentRef: { name: "comp" },
      arguments: args,
    });
    const specA = graphSpec({ train: digestless({ epochs: "10" }) });
    const specB = graphSpec({ train: digestless({ epochs: "20" }) });

    const [diff] = buildPipelineComparison(side(specA), side(specB)).taskDiffs;

    expect(diff.status).toBe("changed");
    expect(diff.componentChanged).toBe(false);
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

    const [diff] = buildPipelineComparison(side(specA), side(specB)).taskDiffs;

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

    const [diff] = buildPipelineComparison(side(specA), side(specB)).taskDiffs;

    expect(diff.status).toBe("changed");
    expect(diff.cacheChanged).toBe(true);
    expect(diff.cacheDisabledA).toBe(true);
    expect(diff.cacheDisabledB).toBe(false);
  });

  test("flags a cache staleness change that leaves caching enabled on both sides", () => {
    const staleness = (maxCacheStaleness: string): Partial<TaskSpec> => ({
      executionOptions: { cachingStrategy: { maxCacheStaleness } },
    });
    const specA = graphSpec({ train: task("d1", staleness("P7D")) });
    const specB = graphSpec({ train: task("d1", staleness("P30D")) });

    const [diff] = buildPipelineComparison(side(specA), side(specB)).taskDiffs;

    expect(diff.status).toBe("changed");
    expect(diff.cacheChanged).toBe(false);
    expect(
      diff.settingDiffs.find((entry) => entry.key === "cachingStrategy")
        ?.status,
    ).toBe("changed");
  });

  test("flags a retry strategy change", () => {
    const specA = graphSpec({
      train: task("d1", {
        executionOptions: { retryStrategy: { maxRetries: 1 } },
      }),
    });
    const specB = graphSpec({
      train: task("d1", {
        executionOptions: { retryStrategy: { maxRetries: 5 } },
      }),
    });

    const [diff] = buildPipelineComparison(side(specA), side(specB)).taskDiffs;

    expect(diff.status).toBe("changed");
    expect(
      diff.settingDiffs.find((entry) => entry.key === "retryStrategy")?.status,
    ).toBe("changed");
  });

  test("flags a task guarded by a condition in one run only", () => {
    const specA = graphSpec({
      train: task("d1", { isEnabled: enabledByFlag }),
    });
    const specB = graphSpec({ train: task("d1") });

    const [diff] = buildPipelineComparison(side(specA), side(specB)).taskDiffs;

    expect(diff.status).toBe("changed");
    expect(
      diff.settingDiffs.find((entry) => entry.key === "isEnabled")?.status,
    ).toBe("lost");
  });

  test("reports no setting differences when execution options match", () => {
    const options: Partial<TaskSpec> = {
      isEnabled: enabledByFlag,
      executionOptions: { retryStrategy: { maxRetries: 2 } },
    };
    const specA = graphSpec({ train: task("d1", options) });
    const specB = graphSpec({ train: task("d1", { ...options }) });

    const [diff] = buildPipelineComparison(side(specA), side(specB)).taskDiffs;

    expect(diff.status).toBe("unchanged");
    expect(
      diff.settingDiffs.every((entry) => entry.status === "unchanged"),
    ).toBe(true);
  });

  test("treats structurally equal object arguments as unchanged", () => {
    const arg = { taskOutput: { taskId: "prep", outputName: "data" } };
    const specA = graphSpec({ train: task("d1", { arguments: { in: arg } }) });
    const specB = graphSpec({
      train: task("d1", { arguments: { in: { ...arg } } }),
    });

    const [diff] = buildPipelineComparison(side(specA), side(specB)).taskDiffs;

    expect(diff.status).toBe("unchanged");
  });

  test("carries per-run execution status onto each task diff", () => {
    const specA = graphSpec({ train: task("d1") });
    const specB = graphSpec({ train: task("d1") });

    const [diff] = buildPipelineComparison(
      side(specA, new Map([["train", "SUCCEEDED"]])),
      side(specB, new Map([["train", "FAILED"]])),
    ).taskDiffs;

    expect(diff.statusA).toBe("SUCCEEDED");
    expect(diff.statusB).toBe("FAILED");
  });

  test("carries per-run execution ids onto each task diff", () => {
    const specA = graphSpec({ train: task("d1") });
    const specB = graphSpec({ train: task("d1") });

    const [diff] = buildPipelineComparison(
      side(specA, noStatus, new Map([["train", "exec-a"]])),
      side(specB, noStatus, new Map([["train", "exec-b"]])),
    ).taskDiffs;

    expect(diff.executionIdA).toBe("exec-a");
    expect(diff.executionIdB).toBe("exec-b");
  });

  test("flags an outcome difference even when the task spec is unchanged", () => {
    const specA = graphSpec({ train: task("d1") });
    const specB = graphSpec({ train: task("d1") });

    const { taskDiffs, counts } = buildPipelineComparison(
      side(specA, new Map([["train", "SUCCEEDED"]])),
      side(specB, new Map([["train", "FAILED"]])),
    );

    expect(taskDiffs[0].status).toBe("unchanged");
    expect(taskDiffs[0].outcomeChanged).toBe(true);
    expect(counts.outcomeChanged).toBe(1);
  });

  test("does not flag an outcome difference when both runs share a status", () => {
    const specA = graphSpec({ train: task("d1") });
    const specB = graphSpec({ train: task("d1") });

    const { taskDiffs, counts } = buildPipelineComparison(
      side(specA, new Map([["train", "SUCCEEDED"]])),
      side(specB, new Map([["train", "SUCCEEDED"]])),
    );

    expect(taskDiffs[0].outcomeChanged).toBe(false);
    expect(counts.outcomeChanged).toBe(0);
  });

  test("does not flag an outcome difference for added or removed tasks", () => {
    const specA = graphSpec({ evaluate: task("d1") });
    const specB = graphSpec({ deploy: task("d2") });

    const { taskDiffs, counts } = buildPipelineComparison(
      side(specA, new Map([["evaluate", "SUCCEEDED"]])),
      side(specB, new Map([["deploy", "FAILED"]])),
    );

    const byId = Object.fromEntries(
      taskDiffs.map((diff) => [diff.taskId, diff]),
    );
    expect(byId.evaluate.status).toBe("lost");
    expect(byId.evaluate.outcomeChanged).toBe(false);
    expect(byId.deploy.status).toBe("new");
    expect(byId.deploy.outcomeChanged).toBe(false);
    expect(counts.outcomeChanged).toBe(0);
  });

  test("reports no comparable graph for container-implementation specs", () => {
    const { taskDiffs, hasComparableGraph } = buildPipelineComparison(
      side(containerSpec()),
      side(containerSpec()),
    );

    expect(taskDiffs).toHaveLength(0);
    expect(hasComparableGraph).toBe(false);
  });

  test("treats unrelated pipelines as fully added/removed", () => {
    const specA = graphSpec({ a1: task("d1"), a2: task("d2") });
    const specB = graphSpec({ b1: task("d3") });

    const { counts } = buildPipelineComparison(side(specA), side(specB));

    expect(counts).toEqual({
      added: 1,
      removed: 2,
      changed: 0,
      unchanged: 0,
      outcomeChanged: 0,
      outputArtifactChanged: 0,
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

    const { inputDiffs } = buildPipelineComparison(side(specA), side(specB));
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

  test("reports every task unchanged when both sides are the same spec", () => {
    const spec = graphSpec({ train: task("d1"), evaluate: task("d2") });
    const statuses = new Map([
      ["train", "SUCCEEDED"],
      ["evaluate", "FAILED"],
    ]);

    const { taskDiffs, counts, hasComparableGraph } = buildPipelineComparison(
      side(spec, statuses),
      side(spec, statuses),
    );

    expect(hasComparableGraph).toBe(true);
    expect(taskDiffs.every((diff) => diff.status === "unchanged")).toBe(true);
    expect(taskDiffs.every((diff) => !diff.outcomeChanged)).toBe(true);
    expect(counts.changed).toBe(0);
    expect(counts.added).toBe(0);
    expect(counts.removed).toBe(0);
    expect(counts.outcomeChanged).toBe(0);
  });

  test("reports no comparable graph when both specs are undefined", () => {
    const { hasComparableGraph, taskDiffs } = buildPipelineComparison(
      side(undefined),
      side(undefined),
    );

    expect(hasComparableGraph).toBe(false);
    expect(taskDiffs).toHaveLength(0);
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

    const { outputDiffs } = buildPipelineComparison(side(specA), side(specB));

    const model = outputDiffs.find((d) => d.name === "model");
    expect(model?.status).toBe("changed");
    expect(model?.sourceTaskIdA).toBe("train");
    expect(model?.sourceTaskIdB).toBe("tune");
    expect(model?.fieldDiffs.find((f) => f.key === "source")?.status).toBe(
      "changed",
    );
  });

  test("flags an output whose artifact differs even though the spec matched", () => {
    const spec = outputSpec();

    const { outputDiffs, counts } = buildPipelineComparison(
      sideWithArtifacts(spec, { model: artifact("a1", { total_size: 1_000 }) }),
      sideWithArtifacts(spec, { model: artifact("b1", { total_size: 9_000 }) }),
    );

    const model = outputDiffs[0];
    expect(model.status).toBe("unchanged");
    expect(model.artifactStatus).toBe("changed");
    expect(ioDisplayStatus(model)).toBe("changed");
    expect(counts.outputArtifactChanged).toBe(1);
  });

  test("leaves an output unchanged when the artifacts match", () => {
    const spec = outputSpec();
    const data = { total_size: 1_000, value: "gs://bucket/model" };

    const { outputDiffs, counts } = buildPipelineComparison(
      sideWithArtifacts(spec, { model: artifact("a1", data) }),
      sideWithArtifacts(spec, { model: artifact("b1", data) }),
    );

    expect(outputDiffs[0].artifactStatus).toBe("unchanged");
    expect(ioDisplayStatus(outputDiffs[0])).toBe("unchanged");
    expect(counts.outputArtifactChanged).toBe(0);
  });

  test("reports an artifact missing on one side as a value difference, not a removal", () => {
    const spec = outputSpec();

    const { outputDiffs, counts } = buildPipelineComparison(
      sideWithArtifacts(spec, { model: artifact("a1", { total_size: 10 }) }),
      sideWithArtifacts(spec, {}),
    );

    expect(outputDiffs[0].status).toBe("unchanged");
    expect(outputDiffs[0].artifactStatus).toBe("lost");
    expect(ioDisplayStatus(outputDiffs[0])).toBe("changed");
    expect(counts.outputArtifactChanged).toBe(1);
  });

  test("does not count the artifact of an output only one run declares", () => {
    const { outputDiffs, counts } = buildPipelineComparison(
      sideWithArtifacts(outputSpec(), {
        model: artifact("a1", { total_size: 10 }),
      }),
      side(graphSpec({})),
    );

    expect(outputDiffs[0].status).toBe("lost");
    expect(ioDisplayStatus(outputDiffs[0])).toBe("lost");
    expect(counts.outputArtifactChanged).toBe(0);
  });

  test("leaves the artifact axis undefined before artifact data arrives", () => {
    const spec = outputSpec();

    const { outputDiffs, counts } = buildPipelineComparison(
      side(spec),
      side(spec),
    );

    expect(outputDiffs[0].artifactStatus).toBeUndefined();
    expect(ioDisplayStatus(outputDiffs[0])).toBe("unchanged");
    expect(counts.outputArtifactChanged).toBe(0);
  });

  test("does not report a difference while only one side's artifacts are known", () => {
    const spec = outputSpec();

    const { outputDiffs, counts } = buildPipelineComparison(
      sideWithArtifacts(spec, { model: artifact("a1", { total_size: 10 }) }),
      side(spec),
    );

    expect(outputDiffs[0].artifactStatus).toBeUndefined();
    expect(ioDisplayStatus(outputDiffs[0])).toBe("unchanged");
    expect(counts.outputArtifactChanged).toBe(0);
  });

  test("tallies inputs and outputs alongside tasks", () => {
    const spec = ioGraphSpec();

    const { counts } = buildPipelineComparison(side(spec), side(spec));

    expect(counts).toEqual({
      added: 0,
      removed: 0,
      changed: 0,
      unchanged: 3,
      outcomeChanged: 0,
      outputArtifactChanged: 0,
    });
  });

  test("tallies an input only one run declares", () => {
    const withInput = ioGraphSpec();
    const withoutInput: ComponentSpec = { ...withInput, inputs: [] };

    const { counts } = buildPipelineComparison(
      side(withoutInput),
      side(withInput),
    );

    expect(counts.added).toBe(1);
    expect(counts.unchanged).toBe(2);
  });

  test("tallies an output whose artifact differs as changed", () => {
    const spec = outputSpec();

    const { counts } = buildPipelineComparison(
      sideWithArtifacts(spec, { model: artifact("a1", { total_size: 1_000 }) }),
      sideWithArtifacts(spec, { model: artifact("b1", { total_size: 9_000 }) }),
    );

    expect(counts.changed).toBe(1);
    expect(counts.unchanged).toBe(1);
  });
});
