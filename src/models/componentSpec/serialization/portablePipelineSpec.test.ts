import { describe, expect, it } from "vitest";

import type {
  ArgumentType,
  ComponentSpec,
  TaskSpec,
} from "@/utils/componentSpec";

import { toPortablePipelineSpec } from "./portablePipelineSpec";

const LIBRARY_FIELDS = {
  favorited: true,
  owned: true,
  deprecated: true,
  published_by: "someone",
  superseded_by: "some-digest",
};

function graphPipeline(tasks: Record<string, TaskSpec>): ComponentSpec {
  return {
    name: "Pipeline",
    implementation: { graph: { tasks } },
  };
}

function graphTasks(spec: ComponentSpec): Record<string, TaskSpec> {
  if (!("graph" in spec.implementation)) {
    throw new Error("expected a graph implementation");
  }
  return spec.implementation.graph.tasks;
}

function nestedSpec(task: TaskSpec): ComponentSpec {
  const spec = task.componentRef.spec;
  if (!spec) throw new Error("expected a nested spec");
  return spec;
}

// A document reaching the projection may carry keys the wire types do not
// describe — that is the whole reason the projection exists — so malformed
// fixtures are built loosely and narrowed here rather than at each use.
function malformed<T>(value: unknown): T {
  return value as T;
}

describe("toPortablePipelineSpec", () => {
  it("strips component-library fields at the root", () => {
    const spec = malformed<ComponentSpec>({
      ...graphPipeline({}),
      ...LIBRARY_FIELDS,
    });

    const portable = toPortablePipelineSpec(spec);

    expect(Object.keys(portable)).toEqual(["name", "implementation"]);
  });

  it("strips component-library fields from a nested task componentRef", () => {
    const spec = graphPipeline({
      train: {
        componentRef: {
          name: "Train",
          digest: "sha256:abc",
          ...LIBRARY_FIELDS,
        },
      },
    });

    const portable = toPortablePipelineSpec(spec);

    expect(Object.keys(graphTasks(portable).train.componentRef)).toEqual([
      "name",
      "digest",
    ]);
  });

  it("strips a stale value from an input while keeping its default", () => {
    const spec: ComponentSpec = {
      ...graphPipeline({}),
      inputs: [{ name: "epochs", type: "Integer", default: "10", value: "42" }],
    };

    const portable = toPortablePipelineSpec(spec);

    expect(portable.inputs?.[0]).toEqual({
      name: "epochs",
      type: "Integer",
      default: "10",
    });
  });

  it("preserves annotations on the pipeline, its tasks and its ports", () => {
    const position = JSON.stringify({ x: 120, y: 340 });
    const spec: ComponentSpec = {
      ...graphPipeline({
        train: {
          componentRef: { name: "Train" },
          annotations: { "editor.position": position },
        },
      }),
      metadata: { annotations: { "pipeline.owner": "team" } },
      inputs: [
        { name: "epochs", annotations: { "editor.position": position } },
      ],
      outputs: [
        { name: "model", annotations: { "editor.position": position } },
      ],
    };

    const portable = toPortablePipelineSpec(spec);

    expect(portable.metadata).toEqual({
      annotations: { "pipeline.owner": "team" },
    });
    expect(graphTasks(portable).train.annotations).toEqual({
      "editor.position": position,
    });
    expect(portable.inputs?.[0].annotations).toEqual({
      "editor.position": position,
    });
    expect(portable.outputs?.[0].annotations).toEqual({
      "editor.position": position,
    });
  });

  it("preserves a container implementation two subgraph levels down", () => {
    const container = {
      image: "python:3.11",
      command: ["python", "-m", "train"],
      args: ["--fast"],
      env: { LOG_LEVEL: "debug" },
    };
    const middle = graphPipeline({
      train: {
        componentRef: {
          name: "Train",
          spec: { name: "Train", implementation: { container } },
          ...LIBRARY_FIELDS,
        },
      },
    });
    const spec = graphPipeline({
      outer: {
        componentRef: { name: "Subgraph", spec: middle, ...LIBRARY_FIELDS },
      },
    });

    const portable = toPortablePipelineSpec(spec);

    const innerTasks = graphTasks(nestedSpec(graphTasks(portable).outer));
    const leaf = nestedSpec(innerTasks.train);

    expect(leaf.implementation).toEqual({ container });
    expect(innerTasks.train.componentRef).not.toHaveProperty("favorited");
  });

  it("preserves placeholder objects inside a container command", () => {
    const command = [
      "python",
      { inputValue: "epochs" },
      { outputPath: "model" },
      { if: { cond: { isPresent: "epochs" }, then: ["--epochs"] } },
    ];
    const spec: ComponentSpec = {
      name: "Train",
      implementation: { container: { image: "python:3.11", command } },
    };

    const portable = toPortablePipelineSpec(spec);

    expect(portable.implementation).toEqual({
      container: { image: "python:3.11", command },
    });
  });

  it("passes a nested dynamicData payload through unchanged", () => {
    const dynamicData = {
      source: "vault",
      lookup: { key: "api-token", scope: { env: "staging", tags: ["a", "b"] } },
    };
    const spec = graphPipeline({
      train: {
        componentRef: { name: "Train" },
        arguments: { token: malformed<ArgumentType>({ dynamicData }) },
      },
    });

    const portable = toPortablePipelineSpec(spec);

    const token = graphTasks(portable).train.arguments?.token;
    expect(token).toEqual({ dynamicData });
    expect(JSON.stringify(token)).toBe(JSON.stringify({ dynamicData }));
  });

  it("drops an argument that carries dynamicData alongside a sibling key", () => {
    const spec = graphPipeline({
      train: {
        componentRef: { name: "Train" },
        arguments: {
          safe: "plain",
          mixed: malformed<ArgumentType>({
            dynamicData: { source: "vault" },
            taskOutput: { taskId: "prep", outputName: "data" },
          }),
        },
      },
    });

    const portable = toPortablePipelineSpec(spec);

    expect(graphTasks(portable).train.arguments).toEqual({ safe: "plain" });
  });

  it("keeps the source key order so an unchanged document round-trips", () => {
    const spec = {
      name: "Pipeline",
      description: "A pipeline",
      metadata: { annotations: { a: "1" } },
      inputs: [{ name: "epochs", type: "Integer" }],
      outputs: [{ name: "model", type: "Model" }],
      implementation: { graph: { tasks: {} } },
    } satisfies ComponentSpec;

    const portable = toPortablePipelineSpec(spec);

    expect(JSON.stringify(portable)).toBe(JSON.stringify(spec));
  });
});
