import { RunContext } from "@openai/agents-core";
import { describe, expect, it, vi } from "vitest";

import type { ToolBridgeApi } from "../toolBridgeApi";
import { createCsomTools } from "./csomTools";

type FunctionTool = ReturnType<typeof createCsomTools>["allTools"][number];

interface JsonSchemaNode {
  type?: string | string[];
  properties?: Record<string, JsonSchemaNode>;
  anyOf?: JsonSchemaNode[];
  additionalProperties?: boolean | JsonSchemaNode;
  $ref?: string;
}

/**
 * Lightweight stub bridge: only the methods a test sets via `overrides`
 * are ever called. Anything else returns a vi.fn() so unrelated tools
 * don't blow up if they're inspected through the same factory call.
 */
function makeBridge(overrides: Partial<ToolBridgeApi> = {}): ToolBridgeApi {
  const stub = vi.fn();
  return new Proxy({} as ToolBridgeApi, {
    get(_target, prop: string) {
      if (prop in overrides) {
        return (overrides as Record<string, unknown>)[prop];
      }
      return stub;
    },
  });
}

function findTool(
  tools: ReadonlyArray<FunctionTool>,
  name: string,
): FunctionTool {
  const found = tools.find((t) => t.name === name);
  if (!found) throw new Error(`Tool not found: ${name}`);
  return found;
}

async function invoke(tool: FunctionTool, payload: unknown): Promise<unknown> {
  const ctx = new RunContext();
  const raw = await tool.invoke(ctx, JSON.stringify(payload));
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

function getImplementationAnyOf(schema: JsonSchemaNode): JsonSchemaNode[] {
  const componentRef = schema.properties?.componentRef;
  if (!componentRef) return [];

  const specAnyOf = componentRef.properties?.spec?.anyOf;
  if (!specAnyOf) return [];

  const specObjectSchema = specAnyOf.find((entry) => entry.type === "object");
  if (!specObjectSchema) return [];

  return specObjectSchema.properties?.implementation?.anyOf ?? [];
}

describe("createCsomTools", () => {
  it("exposes the full 18-tool surface", () => {
    const { allTools } = createCsomTools(makeBridge());
    const names = allTools.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        "add_input",
        "add_output",
        "add_task",
        "connect_nodes",
        "create_subgraph",
        "delete_edge",
        "delete_input",
        "delete_output",
        "delete_task",
        "get_pipeline_state",
        "rename_input",
        "rename_output",
        "rename_task",
        "set_pipeline_description",
        "set_pipeline_name",
        "set_task_argument",
        "unpack_subgraph",
        "validate_pipeline",
      ].sort(),
    );
  });

  it("get_pipeline_state JSON-stringifies the bridge result for the model", async () => {
    const getPipelineState = vi.fn().mockResolvedValue({
      name: "Pipe",
      inputs: [],
      outputs: [],
      tasks: [],
      bindings: [],
    });
    const { allTools } = createCsomTools(makeBridge({ getPipelineState }));

    const result = await invoke(findTool(allTools, "get_pipeline_state"), {});
    expect(result).toEqual({
      name: "Pipe",
      inputs: [],
      outputs: [],
      tasks: [],
      bindings: [],
    });
    expect(getPipelineState).toHaveBeenCalledOnce();
  });

  it("validate_pipeline JSON-stringifies the validation result for the model", async () => {
    const validatePipeline = vi.fn().mockResolvedValue({
      valid: true,
      issueCount: 0,
      issues: [],
    });
    const { allTools } = createCsomTools(makeBridge({ validatePipeline }));

    const result = await invoke(findTool(allTools, "validate_pipeline"), {});
    expect(result).toEqual({ valid: true, issueCount: 0, issues: [] });
  });

  it("add_task strips null fields from the componentRef before calling the bridge", async () => {
    const addTask = vi.fn().mockResolvedValue({
      success: true,
      taskId: "task_42",
      name: "Loader",
    });
    const { allTools } = createCsomTools(makeBridge({ addTask }));

    await invoke(findTool(allTools, "add_task"), {
      name: "Loader",
      componentRef: {
        name: "loader",
        url: null,
        spec: {
          name: "Loader",
          description: null,
          inputs: [{ name: "path", type: "String", description: null }],
          outputs: null,
          implementation: { container: { image: "loader:1" } },
        },
      },
    });

    expect(addTask).toHaveBeenCalledOnce();
    const call = addTask.mock.calls[0][0];
    expect(call.name).toBe("Loader");
    expect(call.componentRef).toEqual({
      name: "loader",
      spec: {
        name: "Loader",
        inputs: [{ name: "path", type: "String" }],
        implementation: { container: { image: "loader:1" } },
      },
    });
  });

  it("add_task implementation schema has typed anyOf branches", () => {
    // Regression guard for OpenAI structured-outputs strict mode: every
    // `anyOf` branch must declare a concrete `type` (or `$ref`), or tool
    // registration fails before the model even runs.
    const { allTools } = createCsomTools(makeBridge());
    const addTaskTool = findTool(allTools, "add_task");

    const implementationAnyOf = getImplementationAnyOf(
      addTaskTool.parameters as JsonSchemaNode,
    );

    expect(implementationAnyOf).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "object" }),
        expect.objectContaining({ type: "null" }),
      ]),
    );
    expect(
      implementationAnyOf.every((entry) => typeof entry.type === "string"),
    ).toBe(true);

    const objectBranch = implementationAnyOf.find(
      (entry) => entry.type === "object",
    );
    expect(objectBranch).toBeDefined();
    const additionalProperties = objectBranch?.additionalProperties;
    expect(additionalProperties).not.toEqual({});
    if (
      additionalProperties &&
      typeof additionalProperties === "object" &&
      !Array.isArray(additionalProperties)
    ) {
      expect(
        typeof additionalProperties.type === "string" ||
          typeof additionalProperties.$ref === "string",
      ).toBe(true);
    }
  });

  it("rename_task forwards (entityId, newName) in the right order", async () => {
    // Both args are strings — TypeScript can't catch a swap, so this
    // pin is the only guard against a regression.
    const renameTask = vi.fn().mockResolvedValue({ success: true });
    const { allTools } = createCsomTools(makeBridge({ renameTask }));

    await invoke(findTool(allTools, "rename_task"), {
      entityId: "task_1",
      newName: "Renamed",
    });
    expect(renameTask).toHaveBeenCalledWith("task_1", "Renamed");
  });

  it("rename_input forwards (entityId, newName) in the right order", async () => {
    const renameInput = vi.fn().mockResolvedValue({ success: true });
    const { allTools } = createCsomTools(makeBridge({ renameInput }));

    await invoke(findTool(allTools, "rename_input"), {
      entityId: "input_1",
      newName: "renamed",
    });
    expect(renameInput).toHaveBeenCalledWith("input_1", "renamed");
  });

  it("rename_output forwards (entityId, newName) in the right order", async () => {
    const renameOutput = vi.fn().mockResolvedValue({ success: true });
    const { allTools } = createCsomTools(makeBridge({ renameOutput }));

    await invoke(findTool(allTools, "rename_output"), {
      entityId: "output_1",
      newName: "renamed",
    });
    expect(renameOutput).toHaveBeenCalledWith("output_1", "renamed");
  });

  it("set_task_argument forwards (taskEntityId, inputName, value) in the right order", async () => {
    // Three string positional args — TypeScript can't catch a swap.
    const setTaskArgument = vi.fn().mockResolvedValue({ success: true });
    const { allTools } = createCsomTools(makeBridge({ setTaskArgument }));

    await invoke(findTool(allTools, "set_task_argument"), {
      taskEntityId: "task_1",
      inputName: "path",
      value: "data.csv",
    });
    expect(setTaskArgument).toHaveBeenCalledWith("task_1", "path", "data.csv");
  });

  it("add_input normalizes null optional fields to undefined", async () => {
    const addInput = vi.fn().mockResolvedValue({
      success: true,
      inputId: "input_42",
      name: "threshold",
    });
    const { allTools } = createCsomTools(makeBridge({ addInput }));

    await invoke(findTool(allTools, "add_input"), {
      name: "threshold",
      type: "Float",
      description: null,
      defaultValue: null,
      optional: null,
    });

    expect(addInput).toHaveBeenCalledWith({
      name: "threshold",
      type: "Float",
      description: undefined,
      defaultValue: undefined,
      optional: undefined,
    });
  });

  it("add_output strips null optional fields to undefined", async () => {
    const addOutput = vi.fn().mockResolvedValue({
      success: true,
      outputId: "output_42",
      name: "metrics",
    });
    const { allTools } = createCsomTools(makeBridge({ addOutput }));

    await invoke(findTool(allTools, "add_output"), {
      name: "metrics",
      type: null,
      description: null,
    });
    expect(addOutput).toHaveBeenCalledWith({
      name: "metrics",
      type: undefined,
      description: undefined,
    });
  });
});
