import type { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import {
  Binding,
  ComponentSpec,
  Input,
  Output,
  Task,
} from "@/models/componentSpec";
import type { UndoGroupable } from "@/routes/v2/shared/nodes/types";

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

import { createToolBridge } from "./toolBridge";

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
  const bridge = createToolBridge({
    getSpec: () => spec,
    getActiveSubgraphPath: () => [],
    undo,
  });
  return { bridge, undo, spec };
}

function makeEmptyBridge() {
  const undo = new RecordingUndo();
  const bridge = createToolBridge({
    getSpec: () => null,
    getActiveSubgraphPath: () => [],
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
  const bridge = createToolBridge({
    getSpec: () => spec,
    getActiveSubgraphPath: () => [],
    undo,
    getBackendUrl: () => TEST_BACKEND_URL,
    getAuthToken: () => overrides.authToken,
    queryClient: overrides.queryClient,
  });
  return { bridge, spec };
}

describe("createToolBridge", () => {
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
    it("returns the serialized spec with the active subgraph path", async () => {
      const spec = buildSpec();
      const undo = new RecordingUndo();
      const bridge = createToolBridge({
        getSpec: () => spec,
        getActiveSubgraphPath: () => ["preprocess"],
        undo,
      });

      const state = await bridge.getPipelineState();
      expect(state.name).toBe("Pipe");
      expect(state.tasks).toHaveLength(1);
      expect(state.activeSubgraphPath).toEqual(["preprocess"]);
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

    it("deleteTask returns success false for unknown id", async () => {
      const { bridge } = makeBridge();
      const result = await bridge.deleteTask("does-not-exist");
      expect(result).toEqual({ success: false });
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
      const bridge = createToolBridge({
        getSpec: () => spec,
        getActiveSubgraphPath: () => [],
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
  });

  describe("subgraphs", () => {
    it("createSubgraph returns the new subgraph task id", async () => {
      const { bridge, spec } = makeBridge();
      const result = await bridge.createSubgraph(["task_1"], "Group");
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
      expect(result.error).toMatch(/Could not create subgraph/);
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
      const bridge = createToolBridge({
        getSpec: () => spec,
        getActiveSubgraphPath: () => [],
        undo,
      });

      const result = await bridge.validatePipeline();
      expect(result.valid).toBe(true);
      expect(result.issueCount).toBe(0);
    });

    it("maps validation issues into the wire shape", async () => {
      const spec = new ComponentSpec({ $id: "spec_1", name: "" });
      const undo = new RecordingUndo();
      const bridge = createToolBridge({
        getSpec: () => spec,
        getActiveSubgraphPath: () => [],
        undo,
      });

      const result = await bridge.validatePipeline();
      expect(result.valid).toBe(false);
      expect(result.issueCount).toBeGreaterThan(0);
      for (const issue of result.issues) {
        expect(typeof issue.type).toBe("string");
        expect(typeof issue.severity).toBe("string");
        expect(typeof issue.message).toBe("string");
      }
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
