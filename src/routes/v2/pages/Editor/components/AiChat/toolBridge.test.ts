import type { QueryClient } from "@tanstack/react-query";
import type { Node } from "@xyflow/react";
import { describe, expect, it, vi } from "vitest";

import {
  Binding,
  ComponentSpec,
  Input,
  Output,
  Task,
} from "@/models/componentSpec";
import { IncrementingIdGenerator } from "@/models/componentSpec/factories/idGenerator";
import { YamlDeserializer } from "@/models/componentSpec/serialization/yamlDeserializer";
import { ONBOARDING_MY_RUN_COUNT_KEY } from "@/providers/OnboardingProvider/onboardingQueryKeys";
import type { UndoGroupable } from "@/routes/v2/shared/nodes/types";
import { hydrateComponentReference } from "@/services/componentService";
import { EDITOR_POSITION_ANNOTATION } from "@/utils/annotations";

vi.mock("@/services/componentService", () => ({
  hydrateComponentReference: vi.fn(async (ref) => ref),
}));

const fetchPipelineRunMock = vi.fn();
const fetchExecutionDetailsMock = vi.fn();
const fetchExecutionStateMock = vi.fn();
const fetchContainerExecutionStateMock = vi.fn();
const fetchContainerLogMock = vi.fn();

vi.mock("@/services/executionService", () => ({
  fetchPipelineRun: (...args: unknown[]) => fetchPipelineRunMock(...args),
  fetchExecutionDetails: (...args: unknown[]) =>
    fetchExecutionDetailsMock(...args),
  fetchExecutionState: (...args: unknown[]) => fetchExecutionStateMock(...args),
  fetchContainerExecutionState: (...args: unknown[]) =>
    fetchContainerExecutionStateMock(...args),
  fetchContainerLog: (...args: unknown[]) => fetchContainerLogMock(...args),
}));

const submitPipelineRunHelperMock = vi.fn<
  (
    _spec: unknown,
    _url: string,
    options: {
      authorizationToken?: string;
      onSuccess?: (data: unknown) => void;
      onError?: (error: Error) => void;
    },
  ) => void
>();

vi.mock("@/utils/submitPipeline", () => ({
  submitPipelineRun: (...args: unknown[]) =>
    submitPipelineRunHelperMock(
      ...(args as Parameters<typeof submitPipelineRunHelperMock>),
    ),
}));

import { createEditorToolBridge } from "./toolBridge";

/**
 * Pass-through undo stub: records every withGroup label invoked so tests
 * can assert that mutations were properly wrapped, while still running
 * the inner fn synchronously so MobX state actually changes.
 */
class RecordingUndo implements UndoGroupable {
  readonly labels: string[] = [];
  withGroup<T>(label: string, fn: () => T): T {
    this.labels.push(label);
    return fn();
  }
}

function buildSpec(): ComponentSpec {
  const spec = new ComponentSpec({ $id: "spec_1", name: "Pipe" });
  spec.addInput(new Input({ $id: "input_1", name: "data", type: "String" }));
  spec.addOutput(
    new Output({ $id: "output_1", name: "result", type: "String" }),
  );
  spec.addTask(
    new Task({
      $id: "task_1",
      name: "Transform",
      componentRef: {
        name: "transform",
        spec: {
          name: "Transform",
          inputs: [{ name: "input", type: "String" }],
          outputs: [{ name: "output", type: "String" }],
          implementation: { container: { image: "transform:1" } },
        },
      },
    }),
  );
  return spec;
}

function makeBridge() {
  const spec = buildSpec();
  const undo = new RecordingUndo();
  const bridge = createEditorToolBridge({
    getSpec: () => spec,
    getActiveSubgraphPath: () => [],
    getActiveSubgraphTaskId: () => undefined,
    undo,
  });
  return { bridge, undo, spec };
}

const containerComponent = (
  name: string,
  image: string,
  inputName: string,
  outputName: string,
) => ({
  name,
  spec: {
    name,
    inputs: [{ name: inputName, type: "String" }],
    outputs: [{ name: outputName, type: "String" }],
    implementation: { container: { image } },
  },
});

const nestedPipelineYaml = (extraInnerTasks: Record<string, unknown> = {}) => ({
  name: "RootPipeline",
  inputs: [{ name: "raw_path", type: "String" }],
  implementation: {
    graph: {
      tasks: {
        Preprocess: {
          componentRef: {
            name: "Preprocess",
            spec: {
              name: "Preprocess",
              inputs: [{ name: "path", type: "String" }],
              outputs: [{ name: "table", type: "String" }],
              implementation: {
                graph: {
                  tasks: {
                    DropNulls: {
                      componentRef: containerComponent(
                        "DropNulls",
                        "clean:1",
                        "path",
                        "table",
                      ),
                      arguments: {
                        path: { graphInput: { inputName: "path" } },
                      },
                    },
                    ...extraInnerTasks,
                  },
                },
              },
            },
          },
        },
        Train: {
          componentRef: containerComponent(
            "Train",
            "train:1",
            "table",
            "model",
          ),
        },
      },
    },
  },
});

function makeNestedBridge(extraInnerTasks?: Record<string, unknown>) {
  const spec = new YamlDeserializer(new IncrementingIdGenerator()).deserialize(
    nestedPipelineYaml(extraInnerTasks),
  );
  const undo = new RecordingUndo();
  const bridge = createEditorToolBridge({
    getSpec: () => spec,
    getActiveSubgraphPath: () => [],
    getActiveSubgraphTaskId: () => undefined,
    undo,
  });
  const preprocess = spec.tasks.find((t) => t.name === "Preprocess");
  if (!preprocess?.subgraphSpec) {
    throw new Error("Preprocess did not deserialize as a subgraph");
  }
  return { bridge, spec, undo, inner: preprocess.subgraphSpec };
}

function taskId(spec: ComponentSpec, name: string): string {
  const task = spec.tasks.find((t) => t.name === name);
  if (!task) throw new Error(`No task named ${name}`);
  return task.$id;
}

function makeEmptyBridge() {
  const undo = new RecordingUndo();
  const bridge = createEditorToolBridge({
    getSpec: () => null,
    getActiveSubgraphPath: () => [],
    getActiveSubgraphTaskId: () => undefined,
    undo,
  });
  return { bridge, undo };
}

const TEST_BACKEND_URL = "http://backend.test";

function makeBackendBridge(
  overrides: {
    authToken?: string;
    queryClient?: QueryClient;
  } = {},
) {
  const spec = buildSpec();
  const undo = new RecordingUndo();
  const bridge = createEditorToolBridge({
    getSpec: () => spec,
    getActiveSubgraphPath: () => [],
    getActiveSubgraphTaskId: () => undefined,
    undo,
    getBackendUrl: () => TEST_BACKEND_URL,
    getAuthToken: () => overrides.authToken,
    queryClient: overrides.queryClient,
  });
  return { bridge, spec };
}

describe("createEditorToolBridge", () => {
  describe("requireSpec guard", () => {
    it("throws on every mutating call when getSpec returns null", async () => {
      const { bridge } = makeEmptyBridge();
      await expect(bridge.getPipelineState()).rejects.toThrow(
        /No pipeline is currently open/,
      );
      await expect(bridge.setPipelineName("X")).rejects.toThrow();
      await expect(bridge.deleteTask("anything")).rejects.toThrow();
    });
  });

  describe("getPipelineState", () => {
    it("returns the serialized spec with the active subgraph path and task id", async () => {
      const spec = buildSpec();
      const undo = new RecordingUndo();
      const bridge = createEditorToolBridge({
        getSpec: () => spec,
        getActiveSubgraphPath: () => ["preprocess"],
        getActiveSubgraphTaskId: () => "task-preprocess",
        undo,
      });

      const state = await bridge.getPipelineState();
      expect(state.name).toBe("Pipe");
      expect(state.tasks).toHaveLength(1);
      expect(state.activeSubgraphPath).toEqual(["preprocess"]);
      expect(state.activeSubgraphTaskId).toBe("task-preprocess");
    });

    it("omits the active subgraph task id at the top level", async () => {
      const spec = buildSpec();
      const undo = new RecordingUndo();
      const bridge = createEditorToolBridge({
        getSpec: () => spec,
        getActiveSubgraphPath: () => [],
        getActiveSubgraphTaskId: () => undefined,
        undo,
      });

      const state = await bridge.getPipelineState();
      expect(state.activeSubgraphPath).toBeUndefined();
      expect(state.activeSubgraphTaskId).toBeUndefined();
    });
  });

  describe("pipeline metadata", () => {
    it("setPipelineName wraps in an undo group and renames the spec", async () => {
      const { bridge, undo, spec } = makeBridge();
      const result = await bridge.setPipelineName("NewName");
      expect(result).toEqual({ success: true });
      expect(spec.name).toBe("NewName");
      expect(undo.labels).toContain("Rename pipeline");
    });

    it("setPipelineDescription updates the spec inside an undo group", async () => {
      const { bridge, undo, spec } = makeBridge();
      const result = await bridge.setPipelineDescription("hi");
      expect(result).toEqual({ success: true });
      expect(spec.description).toBe("hi");
      expect(undo.labels).toContain("Update pipeline description");
    });
  });

  describe("tasks", () => {
    it("addTask adds the task and renames it when the requested name differs from the component name", async () => {
      const { bridge, undo, spec } = makeBridge();
      const result = await bridge.addTask({
        name: "MyLoader",
        componentRef: { name: "load" },
      });
      expect(result.success).toBe(true);
      expect(result.taskId).toBeDefined();
      const added = spec.tasks.find((t) => t.$id === result.taskId);
      expect(added?.name).toBe("MyLoader");
      expect(undo.labels.filter((l) => l === "Add task")).toHaveLength(1);
    });

    it("addTask refuses when another pipeline is opened while the component loads", async () => {
      const original = buildSpec();
      const opened = new ComponentSpec({ $id: "spec_2", name: "Other" });
      let current: ComponentSpec = original;
      const bridge = createEditorToolBridge({
        getSpec: () => current,
        getActiveSubgraphPath: () => [],
        getActiveSubgraphTaskId: () => undefined,
        undo: new RecordingUndo(),
      });

      vi.mocked(hydrateComponentReference).mockImplementationOnce(async () => {
        current = opened;
        return null;
      });

      const result = await bridge.addTask({
        name: "Dedupe",
        componentRef: containerComponent("Dedupe", "dedupe:1", "path", "table"),
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('changed to "Other"');
      expect(opened.tasks).toHaveLength(0);
      expect(original.tasks.map((t) => t.name)).toEqual(["Transform"]);
    });

    it("deleteTask reports an unknown id rather than a bare failure", async () => {
      const { bridge } = makeBridge();
      const result = await bridge.deleteTask("does-not-exist");
      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'No task with $id "does-not-exist" exists in this pipeline.',
      );
    });

    it("deleteTask reports when the id belongs to another kind of entity", async () => {
      const { bridge } = makeBridge();
      const result = await bridge.deleteTask("input_1");
      expect(result.success).toBe(false);
      expect(result.error).toBe(
        '$id "input_1" refers to input "data", not a task.',
      );
    });

    it("deleteTask removes an existing task", async () => {
      const { bridge, spec } = makeBridge();
      const result = await bridge.deleteTask("task_1");
      expect(result.success).toBe(true);
      expect(spec.tasks.find((t) => t.$id === "task_1")).toBeUndefined();
    });

    it("renameTask updates the task name", async () => {
      const { bridge, spec } = makeBridge();
      const result = await bridge.renameTask("task_1", "Renamed");
      expect(result.success).toBe(true);
      expect(spec.tasks[0].name).toBe("Renamed");
    });
  });

  describe("autoLayout", () => {
    function layoutNode(id: string): Node {
      return {
        id,
        position: { x: 0, y: 0 },
        data: {},
        measured: { width: 100, height: 40 },
      };
    }

    it("applies layouted positions to the top-level spec inside one undo group", async () => {
      const spec = buildSpec();
      const undo = new RecordingUndo();
      const bridge = createEditorToolBridge({
        getSpec: () => spec,
        getActiveSubgraphPath: () => [],
        getActiveSubgraphTaskId: () => undefined,
        getNodes: () => [layoutNode("task_1")],
        getEdges: () => [],
        undo,
      });

      const result = await bridge.autoLayout();

      expect(result).toEqual({ success: true });
      const task = spec.tasks.find((t) => t.$id === "task_1");
      expect(task?.annotations.get(EDITOR_POSITION_ANNOTATION)).toBeDefined();
      expect(undo.labels).toContain("Auto layout");
    });

    it("applies positions to the active subgraph, not the root spec", async () => {
      const spec = new YamlDeserializer(
        new IncrementingIdGenerator(),
      ).deserialize(nestedPipelineYaml());
      const preprocess = spec.tasks.find((t) => t.name === "Preprocess");
      const inner = preprocess?.subgraphSpec;
      if (!preprocess || !inner) {
        throw new Error("Preprocess did not deserialize as a subgraph");
      }
      const dropNulls = inner.tasks.find((t) => t.name === "DropNulls");
      if (!dropNulls) throw new Error("DropNulls task missing from subgraph");

      const undo = new RecordingUndo();
      const bridge = createEditorToolBridge({
        getSpec: () => spec,
        getActiveSubgraphPath: () => ["Preprocess"],
        getActiveSubgraphTaskId: () => preprocess.$id,
        getNodes: () => [layoutNode(dropNulls.$id)],
        getEdges: () => [],
        undo,
      });

      const result = await bridge.autoLayout();

      expect(result).toEqual({ success: true });
      expect(
        dropNulls.annotations.get(EDITOR_POSITION_ANNOTATION),
      ).toBeDefined();
    });

    it("fails when the bridge has no live canvas accessors", async () => {
      const { bridge } = makeBridge();
      const result = await bridge.autoLayout();
      expect(result.success).toBe(false);
      expect(result.error).toContain("live pipeline canvas");
    });

    it("reports failure when there are no positioned nodes to arrange", async () => {
      const spec = buildSpec();
      const undo = new RecordingUndo();
      const bridge = createEditorToolBridge({
        getSpec: () => spec,
        getActiveSubgraphPath: () => [],
        getActiveSubgraphTaskId: () => undefined,
        getNodes: () => [],
        getEdges: () => [],
        undo,
      });

      const result = await bridge.autoLayout();

      expect(result.success).toBe(false);
      expect(result.error).toContain("no positioned nodes");
    });
  });

  describe("inputs", () => {
    it("addInput sets type, description, default, and optional in one chain", async () => {
      const { bridge, undo, spec } = makeBridge();
      const result = await bridge.addInput({
        name: "threshold",
        type: "Float",
        description: "cutoff",
        defaultValue: "0.5",
        optional: true,
      });
      expect(result.success).toBe(true);
      const added = spec.inputs.find((i) => i.$id === result.inputId);
      expect(added?.type).toBe("Float");
      expect(added?.description).toBe("cutoff");
      expect(added?.defaultValue).toBe("0.5");
      expect(added?.optional).toBe(true);
      expect(undo.labels).toContain("Set input optional");
    });

    it("deleteInput removes an existing input", async () => {
      const { bridge, spec } = makeBridge();
      const result = await bridge.deleteInput("input_1");
      expect(result.success).toBe(true);
      expect(spec.inputs).toHaveLength(0);
    });

    it("renameInput updates the input name", async () => {
      const { bridge, spec } = makeBridge();
      const result = await bridge.renameInput("input_1", "renamed_input");
      expect(result.success).toBe(true);
      expect(spec.inputs[0].name).toBe("renamed_input");
    });
  });

  describe("outputs", () => {
    it("addOutput sets type and description", async () => {
      const { bridge, undo, spec } = makeBridge();
      const result = await bridge.addOutput({
        name: "metrics",
        type: "Json",
        description: "summary",
      });
      expect(result.success).toBe(true);
      const added = spec.outputs.find((o) => o.$id === result.outputId);
      expect(added?.type).toBe("Json");
      expect(added?.description).toBe("summary");
      expect(undo.labels).toContain("Set output type");
    });

    it("deleteOutput removes an existing output", async () => {
      const { bridge, spec } = makeBridge();
      const result = await bridge.deleteOutput("output_1");
      expect(result.success).toBe(true);
      expect(spec.outputs).toHaveLength(0);
    });

    it("renameOutput updates the output name", async () => {
      const { bridge, spec } = makeBridge();
      const result = await bridge.renameOutput("output_1", "renamed_output");
      expect(result.success).toBe(true);
      expect(spec.outputs[0].name).toBe("renamed_output");
    });
  });

  describe("connections", () => {
    it("connectNodes returns the created binding id", async () => {
      const { bridge, spec } = makeBridge();
      const result = await bridge.connectNodes({
        sourceEntityId: "input_1",
        sourcePortName: "input_1",
        targetEntityId: "task_1",
        targetPortName: "input",
      });
      expect(result.success).toBe(true);
      expect(result.bindingId).toBeDefined();
      expect(spec.bindings).toHaveLength(1);
    });

    it("connectNodes refuses input → output direction", async () => {
      const { bridge } = makeBridge();
      const result = await bridge.connectNodes({
        sourceEntityId: "input_1",
        sourcePortName: "input_1",
        targetEntityId: "output_1",
        targetPortName: "output_1",
      });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/invalid source\/target/);
    });

    it("connectNodes refuses an output port the task does not declare", async () => {
      const { bridge, spec } = makeBridge();
      const result = await bridge.connectNodes({
        sourceEntityId: "task_1",
        sourcePortName: "typo",
        targetEntityId: "output_1",
        targetPortName: "result",
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('no output named "typo"');
      expect(result.error).toContain('Available: "output"');
      expect(spec.bindings).toHaveLength(0);
    });

    it("connectNodes refuses an input port the task does not declare", async () => {
      const { bridge, spec } = makeBridge();
      const result = await bridge.connectNodes({
        sourceEntityId: "input_1",
        sourcePortName: "data",
        targetEntityId: "task_1",
        targetPortName: "typo",
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('no input named "typo"');
      expect(result.error).toContain('Available: "input"');
      expect(spec.bindings).toHaveLength(0);
    });

    it("connectNodes refuses a pipeline output as the source", async () => {
      const { bridge, spec } = makeBridge();
      const result = await bridge.connectNodes({
        sourceEntityId: "output_1",
        sourcePortName: "result",
        targetEntityId: "task_1",
        targetPortName: "input",
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("outputs only receive values");
      expect(spec.bindings).toHaveLength(0);
    });

    it("connectNodes refuses a pipeline input as the target", async () => {
      const { bridge, spec } = makeBridge();
      const result = await bridge.connectNodes({
        sourceEntityId: "task_1",
        sourcePortName: "output",
        targetEntityId: "input_1",
        targetPortName: "data",
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("inputs only supply values");
      expect(spec.bindings).toHaveLength(0);
    });

    it("deleteEdge removes the binding by id", async () => {
      const spec = buildSpec();
      spec.addBinding(
        new Binding({
          $id: "bind_1",
          sourceEntityId: "input_1",
          sourcePortName: "input_1",
          targetEntityId: "task_1",
          targetPortName: "input",
        }),
      );
      const undo = new RecordingUndo();
      const bridge = createEditorToolBridge({
        getSpec: () => spec,
        getActiveSubgraphPath: () => [],
        getActiveSubgraphTaskId: () => undefined,
        undo,
      });

      const result = await bridge.deleteEdge("bind_1");
      expect(result.success).toBe(true);
      expect(spec.bindings).toHaveLength(0);
    });
  });

  describe("setTaskArgument", () => {
    it("sets the literal value on the task", async () => {
      const { bridge, spec } = makeBridge();
      const result = await bridge.setTaskArgument("task_1", "input", "hello");
      expect(result).toEqual({ success: true });
      const task = spec.tasks.find((t) => t.$id === "task_1");
      expect(task?.arguments).toEqual([{ name: "input", value: "hello" }]);
    });

    it("accepts an input declared by a top-level subgraph task", async () => {
      const { bridge, spec } = makeNestedBridge();
      const preprocessId = taskId(spec, "Preprocess");

      const result = await bridge.setTaskArgument(
        preprocessId,
        "path",
        "/data.csv",
      );

      expect(result).toEqual({ success: true });
      const task = spec.tasks.find((t) => t.$id === preprocessId);
      expect(task?.arguments).toEqual([{ name: "path", value: "/data.csv" }]);
    });

    it("reports an input the task does not declare", async () => {
      const { bridge } = makeBridge();
      const result = await bridge.setTaskArgument("task_1", "nope", "hello");
      expect(result.success).toBe(false);
      expect(result.error).toContain('no input named "nope"');
    });
  });

  describe("subgraphs", () => {
    it("createSubgraph returns the new subgraph task id", async () => {
      const { bridge, spec } = makeNestedBridge();
      const result = await bridge.createSubgraph(
        [taskId(spec, "Preprocess"), taskId(spec, "Train")],
        "Group",
      );
      expect(result.success).toBe(true);
      expect(result.subgraphTaskId).toBeDefined();
      expect(spec.tasks.some((t) => t.$id === result.subgraphTaskId)).toBe(
        true,
      );
    });

    it("createSubgraph reports failure for empty selection", async () => {
      const { bridge } = makeBridge();
      const result = await bridge.createSubgraph([], "Group");
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/at least two distinct tasks/);
    });

    it("createSubgraph refuses to wrap a single task", async () => {
      const { bridge, spec } = makeBridge();
      const result = await bridge.createSubgraph(["task_1"], "Group");
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/at least two distinct tasks/);
      expect(spec.tasks).toHaveLength(1);
    });

    it("createSubgraph refuses the same task id passed twice", async () => {
      const { bridge, spec } = makeBridge();
      const result = await bridge.createSubgraph(["task_1", "task_1"], "Group");
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/at least two distinct tasks/);
      expect(spec.tasks).toHaveLength(1);
    });
  });

  describe("subgraph mutations", () => {
    it("deletes a task inside a subgraph rather than failing", async () => {
      const { bridge, spec, inner } = makeNestedBridge();

      const result = await bridge.deleteTask(taskId(inner, "DropNulls"));

      expect(result).toEqual({ success: true });
      expect(inner.tasks).toHaveLength(0);
      expect(spec.tasks.map((t) => t.name)).toEqual(["Preprocess", "Train"]);
    });

    it("renames a task inside a subgraph without touching the top level", async () => {
      const { bridge, spec, inner } = makeNestedBridge();

      const result = await bridge.renameTask(
        taskId(inner, "DropNulls"),
        "CleanRows",
      );

      expect(result).toEqual({ success: true });
      expect(inner.tasks[0].name).toBe("CleanRows");
      expect(spec.tasks.map((t) => t.name)).toEqual(["Preprocess", "Train"]);
    });

    it("sets an argument on a task inside a subgraph", async () => {
      const { bridge, inner } = makeNestedBridge();

      const result = await bridge.setTaskArgument(
        taskId(inner, "DropNulls"),
        "path",
        "/inner.csv",
      );

      expect(result).toEqual({ success: true });
      expect(inner.tasks[0].arguments).toEqual([
        { name: "path", value: "/inner.csv" },
      ]);
    });

    it("renaming a subgraph input renames the port the parent binds to", async () => {
      const { bridge, spec, inner } = makeNestedBridge();
      const preprocessId = taskId(spec, "Preprocess");
      await bridge.setTaskArgument(preprocessId, "path", "/data.csv");

      const result = await bridge.renameInput(inner.inputs[0].$id, "src_path");

      expect(result).toEqual({ success: true });
      expect(inner.inputs[0].name).toBe("src_path");
      const parentTask = spec.tasks.find((t) => t.$id === preprocessId);
      expect(parentTask?.arguments).toEqual([
        { name: "src_path", value: "/data.csv" },
      ]);
      expect(
        parentTask?.resolvedComponentSpec?.inputs?.map((i) => i.name),
      ).toEqual(["src_path"]);
    });

    it("deleting a subgraph input drops the parent's argument for that port", async () => {
      const { bridge, spec, inner } = makeNestedBridge();
      const preprocessId = taskId(spec, "Preprocess");
      await bridge.setTaskArgument(preprocessId, "path", "/data.csv");

      const result = await bridge.deleteInput(inner.inputs[0].$id);

      expect(result).toEqual({ success: true });
      expect(inner.inputs).toHaveLength(0);
      expect(spec.tasks.find((t) => t.$id === preprocessId)?.arguments).toEqual(
        [],
      );
    });

    it("connects two entities that both live inside a subgraph", async () => {
      const { bridge, spec, inner } = makeNestedBridge();
      const before = inner.bindings.length;

      const result = await bridge.connectNodes({
        sourceEntityId: taskId(inner, "DropNulls"),
        sourcePortName: "table",
        targetEntityId: inner.outputs[0].$id,
        targetPortName: inner.outputs[0].$id,
      });

      expect(result.success).toBe(true);
      expect(inner.bindings.length).toBe(before + 1);
      expect(spec.bindings).toHaveLength(0);
    });

    it("deletes a binding that lives inside a subgraph", async () => {
      const { bridge, spec, inner } = makeNestedBridge();
      expect(inner.bindings.length).toBeGreaterThan(0);

      const result = await bridge.deleteEdge(inner.bindings[0].$id);

      expect(result).toEqual({ success: true });
      expect(inner.bindings).toHaveLength(0);
      expect(spec.bindings).toHaveLength(0);
    });

    it("unpacks a subgraph nested inside another subgraph into its own parent", async () => {
      const { bridge, spec, inner } = makeNestedBridge({
        Dedupe: {
          componentRef: containerComponent(
            "Dedupe",
            "dedupe:1",
            "path",
            "table",
          ),
        },
      });
      const grouped = await bridge.createSubgraph(
        [taskId(inner, "DropNulls"), taskId(inner, "Dedupe")],
        "Cleanup",
      );
      expect(grouped.success).toBe(true);
      expect(inner.tasks.map((t) => t.name)).toEqual(["Cleanup"]);

      const result = await bridge.unpackSubgraph(grouped.subgraphTaskId!);

      expect(result).toEqual({ success: true });
      expect(inner.tasks.map((t) => t.name).sort()).toEqual([
        "Dedupe",
        "DropNulls",
      ]);
      expect(spec.tasks.map((t) => t.name)).toEqual(["Preprocess", "Train"]);
    });

    it("refuses a connection that would cross a subgraph boundary", async () => {
      const { bridge, spec, inner } = makeNestedBridge();

      const result = await bridge.connectNodes({
        sourceEntityId: taskId(spec, "Train"),
        sourcePortName: "model",
        targetEntityId: taskId(inner, "DropNulls"),
        targetPortName: "path",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("cannot cross a subgraph boundary");
      expect(spec.bindings).toHaveLength(0);
      expect(inner.bindings).toHaveLength(1);
    });

    it("refuses to group tasks that live at different levels", async () => {
      const { bridge, spec, inner } = makeNestedBridge();

      const result = await bridge.createSubgraph(
        [taskId(spec, "Train"), taskId(inner, "DropNulls")],
        "Group",
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("must already live in the same");
      expect(result.error).toContain('task "DropNulls" inside subgraph');
    });

    it("reports an unknown connection endpoint instead of writing a dangling binding", async () => {
      const { bridge, spec } = makeNestedBridge();

      const result = await bridge.connectNodes({
        sourceEntityId: "nope",
        sourcePortName: "model",
        targetEntityId: taskId(spec, "Train"),
        targetPortName: "table",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('"nope"');
      expect(spec.bindings).toHaveLength(0);
    });

    it("deleteEdge reports an unknown binding instead of claiming success", async () => {
      const { bridge } = makeNestedBridge();

      const result = await bridge.deleteEdge("not-a-binding");

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'No binding with $id "not-a-binding" exists in this pipeline.',
      );
    });

    it("deleteEdge reports when the id is a task rather than a binding", async () => {
      const { bridge, spec } = makeNestedBridge();

      const result = await bridge.deleteEdge(taskId(spec, "Train"));

      expect(result.success).toBe(false);
      expect(result.error).toContain('refers to task "Train", not a binding');
    });

    it("refuses an argument referencing a graph input from another graph", async () => {
      const { bridge, spec, inner } = makeNestedBridge();

      const result = await bridge.setTaskArgument(
        taskId(inner, "DropNulls"),
        "path",
        { graphInput: { inputName: "raw_path" } },
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('has no input named "raw_path"');
      expect(inner.tasks[0].arguments).toEqual([]);
      expect(spec.inputs.map((i) => i.name)).toEqual(["raw_path"]);
    });

    it("accepts a task output referenced by $id and stores it by name", async () => {
      const { bridge, spec } = makeNestedBridge();

      const result = await bridge.setTaskArgument(
        taskId(spec, "Train"),
        "table",
        {
          taskOutput: {
            taskId: taskId(spec, "Preprocess"),
            outputName: "table",
          },
        },
      );

      expect(result).toEqual({ success: true });
      expect(spec.tasks.find((t) => t.name === "Train")?.arguments).toEqual([
        {
          name: "table",
          value: { taskOutput: { taskId: "Preprocess", outputName: "table" } },
        },
      ]);
    });

    it("explains a rename that collides instead of failing generically", async () => {
      const { bridge, spec } = makeNestedBridge();

      const result = await bridge.renameTask(
        taskId(spec, "Train"),
        "Preprocess",
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("already taken in that graph");
      expect(spec.tasks.map((t) => t.name)).toEqual(["Preprocess", "Train"]);
    });

    it("explains unpacking something that is not a subgraph", async () => {
      const { bridge, spec } = makeNestedBridge();

      const result = await bridge.unpackSubgraph(taskId(spec, "Train"));

      expect(result.success).toBe(false);
      expect(result.error).toContain("is not a subgraph");
      expect(result.error).not.toContain("could not be applied");
    });
  });

  describe("adding into a subgraph", () => {
    it("addTask puts the task inside the named subgraph", async () => {
      const { bridge, spec, inner } = makeNestedBridge();

      const result = await bridge.addTask({
        name: "Dedupe",
        componentRef: containerComponent("Dedupe", "dedupe:1", "path", "table"),
        inSubgraphTaskId: taskId(spec, "Preprocess"),
      });

      expect(result.success).toBe(true);
      expect(inner.tasks.map((t) => t.name).sort()).toEqual([
        "Dedupe",
        "DropNulls",
      ]);
      expect(spec.tasks.map((t) => t.name)).toEqual(["Preprocess", "Train"]);
    });

    it("addInput inside a subgraph becomes an input port on the subgraph task", async () => {
      const { bridge, spec, inner } = makeNestedBridge();
      const preprocessId = taskId(spec, "Preprocess");

      const result = await bridge.addInput({
        name: "threshold",
        type: "Integer",
        inSubgraphTaskId: preprocessId,
      });

      expect(result.success).toBe(true);
      expect(inner.inputs.map((i) => i.name)).toContain("threshold");
      expect(spec.inputs.map((i) => i.name)).toEqual(["raw_path"]);
      expect(
        spec.tasks
          .find((t) => t.$id === preprocessId)
          ?.resolvedComponentSpec?.inputs?.map((i) => i.name),
      ).toContain("threshold");
    });

    it("addOutput inside a subgraph becomes an output port on the subgraph task", async () => {
      const { bridge, spec, inner } = makeNestedBridge();
      const preprocessId = taskId(spec, "Preprocess");

      const result = await bridge.addOutput({
        name: "report",
        inSubgraphTaskId: preprocessId,
      });

      expect(result.success).toBe(true);
      expect(inner.outputs.map((o) => o.name)).toContain("report");
      expect(
        spec.tasks
          .find((t) => t.$id === preprocessId)
          ?.resolvedComponentSpec?.outputs?.map((o) => o.name),
      ).toContain("report");
    });

    it("adds to the top level when inSubgraphTaskId is omitted", async () => {
      const { bridge, spec, inner } = makeNestedBridge();

      const result = await bridge.addInput({ name: "extra" });

      expect(result).toMatchObject({ success: true, name: "extra" });
      expect(spec.inputs.map((i) => i.name)).toEqual(["raw_path", "extra"]);
      expect(inner.inputs.map((i) => i.name)).toEqual(["path"]);
    });

    it("refuses a destination that is not a subgraph", async () => {
      const { bridge, spec } = makeNestedBridge();

      const result = await bridge.addTask({
        name: "Dedupe",
        componentRef: containerComponent("Dedupe", "dedupe:1", "path", "table"),
        inSubgraphTaskId: taskId(spec, "Train"),
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Task "Train" is not a subgraph');
    });

    it("refuses an unknown destination id", async () => {
      const { bridge, spec } = makeNestedBridge();

      const result = await bridge.addOutput({
        name: "report",
        inSubgraphTaskId: "nope",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'No task with $id "nope" exists in this pipeline.',
      );
      expect(spec.outputs).toHaveLength(0);
    });
  });

  describe("validatePipeline", () => {
    it("reports valid: true on a clean spec", async () => {
      const spec = new ComponentSpec({ $id: "spec_1", name: "Pipe" });
      spec.addTask(
        new Task({
          $id: "task_1",
          name: "Op",
          componentRef: {
            name: "op",
            spec: {
              name: "Op",
              implementation: { container: { image: "op:1" } },
            },
          },
        }),
      );
      const undo = new RecordingUndo();
      const bridge = createEditorToolBridge({
        getSpec: () => spec,
        getActiveSubgraphPath: () => [],
        getActiveSubgraphTaskId: () => undefined,
        undo,
      });

      const result = await bridge.validatePipeline();
      expect(result.valid).toBe(true);
      expect(result.issueCount).toBe(0);
    });

    it("maps validation issues into the wire shape", async () => {
      const spec = new ComponentSpec({ $id: "spec_1", name: "" });
      const undo = new RecordingUndo();
      const bridge = createEditorToolBridge({
        getSpec: () => spec,
        getActiveSubgraphPath: () => [],
        getActiveSubgraphTaskId: () => undefined,
        undo,
      });

      const result = await bridge.validatePipeline();
      expect(result.valid).toBe(false);
      expect(result.issueCount).toBeGreaterThan(0);
      for (const issue of result.issues) {
        expect(typeof issue.type).toBe("string");
        expect(typeof issue.severity).toBe("string");
        expect(typeof issue.message).toBe("string");
        expect(issue.subgraphPath).toEqual([]);
      }
    });

    it("reports issues from inside subgraphs with their path", async () => {
      const { bridge } = makeNestedBridge();

      const result = await bridge.validatePipeline();
      const nested = result.issues.filter((i) => i.subgraphPath.length > 0);

      expect(nested.length).toBeGreaterThan(0);
      expect(nested[0].subgraphPath).toEqual(["Preprocess"]);
      expect(result.issueCount).toBe(result.issues.length);
    });
  });

  describe("submitPipelineRun", () => {
    it("returns error when backend is not configured", async () => {
      const { bridge } = makeBridge();
      const result = await bridge.submitPipelineRun();
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Backend is not configured/);
    });

    it("submits the spec, invalidates the cache, and returns ids", async () => {
      const invalidate = vi.fn();
      const queryClient = {
        invalidateQueries: invalidate,
      } as unknown as QueryClient;
      submitPipelineRunHelperMock.mockImplementationOnce(
        (_spec, _url, options) => {
          options.onSuccess?.({
            id: 42,
            root_execution_id: 100,
            created_at: "2025-01-01T00:00:00Z",
            created_by: "tester",
            pipeline_name: "Pipe",
          });
        },
      );

      const { bridge } = makeBackendBridge({
        authToken: "auth-token",
        queryClient,
      });
      const result = await bridge.submitPipelineRun();

      expect(result).toEqual({
        success: true,
        runId: "42",
        rootExecutionId: "100",
      });
      expect(submitPipelineRunHelperMock).toHaveBeenCalledTimes(1);
      const [, urlArg, optionsArg] = submitPipelineRunHelperMock.mock.calls[0]!;
      expect(urlArg).toBe(TEST_BACKEND_URL);
      expect(optionsArg.authorizationToken).toBe("auth-token");
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ["pipelineRuns"] });
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ONBOARDING_MY_RUN_COUNT_KEY,
      });
    });

    it("returns submission failure with the helper's error message", async () => {
      submitPipelineRunHelperMock.mockImplementationOnce(
        (_spec, _url, options) => {
          options.onError?.(new Error("backend rejected"));
        },
      );

      const { bridge } = makeBackendBridge();
      const result = await bridge.submitPipelineRun();
      expect(result.success).toBe(false);
      expect(result.error).toBe("backend rejected");
    });
  });

  describe("read-only run/debug bridge methods", () => {
    it("getRunDetails delegates to fetchPipelineRun", async () => {
      const fakeRun = { id: "1", root_execution_id: "2" };
      fetchPipelineRunMock.mockResolvedValueOnce(fakeRun);
      const { bridge } = makeBackendBridge();
      const result = await bridge.getRunDetails("1");
      expect(result).toBe(fakeRun);
      expect(fetchPipelineRunMock).toHaveBeenCalledWith("1", TEST_BACKEND_URL);
    });

    it("throws when backend url is missing for read-only fetches", async () => {
      const { bridge } = makeBridge();
      await expect(bridge.getExecutionDetails("e1")).rejects.toThrow(
        /Backend is not configured/,
      );
    });

    it("getContainerLog drops null fields and returns the inner shape", async () => {
      fetchContainerLogMock.mockResolvedValueOnce({
        log_text: "hi",
        system_error_exception_full: null,
        orchestration_error_message: undefined,
      });
      const { bridge } = makeBackendBridge();
      const log = await bridge.getContainerLog("e1");
      expect(log).toEqual({ log_text: "hi" });
    });
  });

  describe("debugPipelineRun", () => {
    it("returns success: false with a clear error when backend is missing", async () => {
      const { bridge } = makeBridge();
      const result = await bridge.debugPipelineRun("run-1");
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Backend is not configured/);
      expect(result.failedChildren).toEqual([]);
    });

    it("walks failed children and truncates payloads", async () => {
      fetchPipelineRunMock.mockResolvedValueOnce({
        id: "run-1",
        root_execution_id: "root-1",
      });
      fetchExecutionDetailsMock.mockImplementation(
        async (executionId: string) => {
          if (executionId === "root-1") {
            return {
              id: "root-1",
              task_spec: {},
              child_task_execution_ids: {
                taskA: "exec-A",
                taskB: "exec-B",
                taskC: "exec-C",
              },
            };
          }
          return {
            id: executionId,
            task_spec: {},
            child_task_execution_ids: {},
            input_artifacts: { in1: { id: "art1" } },
            output_artifacts: { out1: { id: "art2" } },
          };
        },
      );
      fetchExecutionStateMock.mockResolvedValueOnce({
        child_execution_status_stats: { taskA: { FAILED: 1 } },
      });
      fetchContainerExecutionStateMock.mockImplementation(
        async (executionId: string) => {
          if (executionId === "exec-A") {
            return {
              status: "FAILED",
              exit_code: 1,
              debug_info: { reason: "OOMKilled" },
            };
          }
          if (executionId === "exec-B") {
            return { status: "SUCCEEDED" };
          }
          throw new Error("no container record");
        },
      );
      const longLog = "x".repeat(20_000);
      fetchContainerLogMock.mockImplementation(async () => ({
        log_text: longLog,
        system_error_exception_full: null,
        orchestration_error_message: null,
      }));

      const { bridge } = makeBackendBridge();
      const result = await bridge.debugPipelineRun("run-1");

      expect(result.success).toBe(true);
      expect(result.run?.id).toBe("run-1");
      expect(result.rootStatus).toBe("FAILED");
      expect(result.failedChildren).toHaveLength(1);
      const failed = result.failedChildren[0];
      expect(failed.taskId).toBe("taskA");
      expect(failed.executionId).toBe("exec-A");
      expect(failed.status).toBe("FAILED");
      expect(failed.log?.truncated).toBe(true);
      expect(failed.log?.log_text?.length).toBeLessThan(longLog.length);
      expect(failed.details?.input_artifacts).toEqual({});
      expect(failed.details?.output_artifacts).toEqual({});
    });
  });
});
