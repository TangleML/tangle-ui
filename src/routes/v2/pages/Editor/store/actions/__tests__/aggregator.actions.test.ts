import { describe, expect, it, vi } from "vitest";

import {
  ComponentSpec,
  Input,
  serializeComponentSpec,
  Task,
} from "@/models/componentSpec";
import {
  createConnectedAggregatorInputNode,
  resetAggregatorOnClone,
  tryConnectAggregatorAddInput,
} from "@/routes/v2/pages/Editor/store/actions/aggregator.actions";
import { deleteSelectedEdgesByEdgeIds } from "@/routes/v2/pages/Editor/store/actions/connection.actions";

const noopUndo = {
  withGroup: <T>(_label: string, fn: () => T): T => fn(),
};

function makeAggregatorTask(taskId: string): Task {
  return new Task({
    $id: taskId,
    name: "Input Aggregator",
    componentRef: {
      url: "https://example.com/input_aggregator.component.yaml",
      digest: "abc123",
      name: "Input Aggregator",
      spec: {
        name: "Input Aggregator",
        metadata: {
          annotations: { is_input_aggregator: "true" },
        },
        inputs: [
          {
            name: "output_type",
            type: "String",
            default: "JsonArray",
            optional: true,
          },
        ],
        outputs: [{ name: "Output", type: "String" }],
        implementation: {
          container: {
            image: "python:3.12-slim",
            command: ["sh", "-ec", "true"],
            args: [
              "--output-type",
              { inputValue: "output_type" },
              "----output-paths",
              { outputPath: "Output" },
            ],
          },
        },
      },
    },
    arguments: [{ name: "output_type", value: "JsonArray" }],
  });
}

describe("aggregator.actions integration", () => {
  it("connect-by-cmd-drop produces a serializable spec with agg_N inputs and bindings", () => {
    const spec = new ComponentSpec({ $id: "spec_1", name: "Pipeline" });
    const task = makeAggregatorTask("task_1");
    spec.addTask(task);

    createConnectedAggregatorInputNode(noopUndo, spec, "task_1", {
      x: 0,
      y: 0,
    });
    createConnectedAggregatorInputNode(noopUndo, spec, "task_1", {
      x: 0,
      y: 100,
    });

    const json = serializeComponentSpec(spec);
    const taskJson = (json.implementation as any).graph.tasks[
      "Input Aggregator"
    ];

    expect(taskJson.componentRef.spec.inputs.map((i: any) => i.name)).toEqual([
      "output_type",
      "agg_1",
      "agg_2",
    ]);
    expect(taskJson.arguments).toEqual({
      output_type: "JsonArray",
      agg_1: { graphInput: { inputName: "agg_1" } },
      agg_2: { graphInput: { inputName: "agg_2" } },
    });
    expect(json.inputs?.map((i) => i.name)).toEqual(["agg_1", "agg_2"]);
  });

  it("connect-from-existing-graph-input creates agg_N input on aggregator", () => {
    const spec = new ComponentSpec({ $id: "spec_1", name: "Pipeline" });
    const task = makeAggregatorTask("task_1");
    spec.addTask(task);

    const existingInput = new Input({ $id: "input_1", name: "user_data" });
    spec.addInput(existingInput);

    const handled = tryConnectAggregatorAddInput(noopUndo, spec, {
      sourceNodeId: existingInput.$id,
      sourceHandleId: `output_${existingInput.$id}`,
      targetNodeId: task.$id,
      targetHandleId: "__add_aggregator_input__",
    });

    expect(handled).toBe(true);

    const json = serializeComponentSpec(spec);
    const taskJson = (json.implementation as any).graph.tasks[
      "Input Aggregator"
    ];

    expect(taskJson.componentRef.spec.inputs.map((i: any) => i.name)).toEqual([
      "output_type",
      "agg_1",
    ]);
    expect(taskJson.arguments).toEqual({
      output_type: "JsonArray",
      agg_1: { graphInput: { inputName: "user_data" } },
    });
  });

  it("deleting an aggregator edge removes the dynamic agg_N input", () => {
    const labels: string[] = [];
    const undo = {
      withGroup: <T>(label: string, fn: () => T): T => {
        labels.push(label);
        return fn();
      },
    };
    const spec = new ComponentSpec({ $id: "spec_1", name: "Pipeline" });
    const task = makeAggregatorTask("task_1");
    spec.addTask(task);

    const existingInput = new Input({ $id: "input_1", name: "user_data" });
    spec.addInput(existingInput);
    const handled = tryConnectAggregatorAddInput(undo, spec, {
      sourceNodeId: existingInput.$id,
      sourceHandleId: `output_${existingInput.$id}`,
      targetNodeId: task.$id,
      targetHandleId: "__add_aggregator_input__",
    });
    expect(handled).toBe(true);

    const bindingId = spec.bindings[0]?.$id;
    expect(bindingId).toBeDefined();
    if (!bindingId) return;

    deleteSelectedEdgesByEdgeIds(undo, spec, [`edge_${bindingId}`]);

    expect(labels).toEqual([
      "Connect to aggregator",
      "Delete selected edges",
      "Remove aggregator input",
    ]);
    expect(spec.bindings).toHaveLength(0);
    expect(task.arguments.find((arg) => arg.name === "agg_1")).toBeUndefined();
    expect(
      task.resolvedComponentSpec?.inputs?.map((input) => input.name),
    ).toEqual(["output_type"]);
  });

  it("resetAggregatorOnClone strips agg_* inputs and arguments", () => {
    const aggRef = {
      url: "https://example.com/input_aggregator.component.yaml",
      digest: "abc123",
      spec: {
        name: "Input Aggregator",
        metadata: { annotations: { is_input_aggregator: "true" } },
        inputs: [
          {
            name: "output_type",
            type: "String",
            default: "JsonArray",
            optional: true,
          },
          { name: "agg_1", type: "String", optional: true },
          { name: "agg_2", type: "String", optional: true },
        ],
        outputs: [{ name: "Output", type: "String" }],
        implementation: {
          container: { image: "x", command: ["sh"], args: [] },
        },
      },
    };
    const args = [
      { name: "output_type", value: "JsonArray" },
      { name: "agg_1", value: { graphInput: { inputName: "agg_1" } } },
      { name: "agg_2", value: { graphInput: { inputName: "agg_2" } } },
    ];

    const reset = resetAggregatorOnClone(aggRef, args);

    expect(reset).not.toBeNull();
    expect(reset!.componentRef.spec!.inputs!.map((i) => i.name)).toEqual([
      "output_type",
    ]);
    expect(reset!.arguments.map((a) => a.name)).toEqual(["output_type"]);
    // text is regenerated to match the stripped spec
    expect(reset!.componentRef.text).not.toContain("agg_1");
  });

  it("resetAggregatorOnClone returns null for non-aggregator tasks", () => {
    const ref = {
      spec: {
        name: "Other",
        inputs: [{ name: "x", type: "String" }],
        implementation: { container: { image: "x", command: ["sh"] } },
      },
    };
    expect(resetAggregatorOnClone(ref, [{ name: "x", value: "1" }])).toBeNull();
  });

  it("non-string metadata annotation values get coerced before submission", async () => {
    // The backend requires metadata.annotations values to be strings. Legacy/
    // imported pipelines occasionally have arrays or objects (e.g. comments:
    // []) — those would 422 the request. submitPipelineRun should sanitize.
    const { submitPipelineRun } = await import("@/utils/submitPipeline");

    let captured: unknown;
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      captured = JSON.parse(init.body as string);
      return new Response(JSON.stringify({ id: 1 }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const dirtySpec = {
      name: "Pipeline",
      metadata: {
        annotations: {
          // legacy non-string values
          comments: [] as unknown,
          stats: { runs: 3 } as unknown,
          author: "alice",
        } as Record<string, unknown>,
      },
      implementation: { graph: { tasks: {} } },
    } as any;

    await submitPipelineRun(dirtySpec, "http://backend");

    vi.unstubAllGlobals();
    const sentAnnotations = (captured as any)?.root_task?.componentRef?.spec
      ?.metadata?.annotations;
    expect(sentAnnotations).toEqual({
      comments: "[]",
      stats: '{"runs":3}',
      author: "alice",
    });
  });
});
