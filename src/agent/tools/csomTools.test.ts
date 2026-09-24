import { RunContext } from "@openai/agents-core";
import { describe, expect, it, vi } from "vitest";

import type { ComponentReference } from "@/utils/componentSpec";

import { createComponentCatalog } from "../componentCatalog";
import type { ToolBridgeApi } from "../toolBridgeApi";
import { createCsomTools } from "./csomTools";

type FunctionTool = ReturnType<typeof createCsomTools>["allTools"][number];

interface JsonSchemaNode {
  type?: string | string[];
  properties?: Record<string, JsonSchemaNode>;
  anyOf?: JsonSchemaNode[];
  allOf?: JsonSchemaNode[];
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

/** An optional field is emitted as an `anyOf` with a null branch beside it. */
function objectBranchOf(
  schema: JsonSchemaNode | undefined,
): JsonSchemaNode | undefined {
  if (!schema) return undefined;
  if (schema.properties) return schema;
  return schema.anyOf?.find((entry) => entry.type === "object");
}

function getImplementationAnyOf(schema: JsonSchemaNode): JsonSchemaNode[] {
  const componentRef = objectBranchOf(schema.properties?.componentRef);
  if (!componentRef) return [];

  const specAnyOf = componentRef.properties?.spec?.anyOf;
  if (!specAnyOf) return [];

  const specObjectSchema = specAnyOf.find((entry) => entry.type === "object");
  if (!specObjectSchema) return [];

  return specObjectSchema.properties?.implementation?.anyOf ?? [];
}

function hasAllOf(schema: JsonSchemaNode | undefined): boolean {
  if (!schema) return false;
  if (schema.allOf) return true;
  if (schema.anyOf?.some(hasAllOf)) return true;
  if (schema.properties && Object.values(schema.properties).some(hasAllOf)) {
    return true;
  }
  const additionalProperties = schema.additionalProperties;
  return (
    typeof additionalProperties === "object" && hasAllOf(additionalProperties)
  );
}

describe("createCsomTools", () => {
  it("exposes the full 30-tool surface", () => {
    const { allTools } = createCsomTools(makeBridge());
    const names = allTools.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        "add_input",
        "add_output",
        "add_sticky_note",
        "add_task",
        "auto_layout",
        "connect_nodes",
        "create_subgraph",
        "delete_edge",
        "delete_input",
        "delete_output",
        "delete_sticky_note",
        "delete_task",
        "get_pipeline_state",
        "get_subgraph_state",
        "move_node",
        "rename_input",
        "rename_output",
        "rename_task",
        "set_pipeline_description",
        "set_pipeline_name",
        "set_pipeline_notes",
        "set_pipeline_tags",
        "set_run_name_template",
        "set_task_argument",
        "set_task_color",
        "unpack_subgraph",
        "update_input",
        "update_output",
        "update_sticky_note",
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

  /**
   * The point of the id: a registry component reaches the canvas whole, with
   * no part of it having to survive a round trip through the tool schema.
   */
  it("add_task resolves a componentId against what search found", async () => {
    const addTask = vi.fn().mockResolvedValue({ success: true });
    const catalog = createComponentCatalog();
    const reference = {
      name: "Filter text",
      spec: {
        name: "Filter text",
        inputs: [{ name: "text" }],
        implementation: {
          container: { image: "python:3.11", env: { LEVEL: "info" } },
        },
      },
    };
    catalog.remember("abc123", reference as ComponentReference);
    const { allTools } = createCsomTools(makeBridge({ addTask }), catalog);

    await invoke(findTool(allTools, "add_task"), {
      name: "Filter",
      componentId: "abc123",
    });

    expect(addTask.mock.calls[0][0].componentRef).toEqual(reference);
  });

  it("add_task says what to do about an id it has never seen", async () => {
    const addTask = vi.fn();
    const { allTools } = createCsomTools(
      makeBridge({ addTask }),
      createComponentCatalog(),
    );

    const result = (await invoke(findTool(allTools, "add_task"), {
      name: "Filter",
      componentId: "never-searched",
    })) as { success: boolean; error: string };

    expect(addTask).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.error).toContain("search_components");
  });

  it("add_task needs either an id or a component to author", async () => {
    const addTask = vi.fn();
    const { allTools } = createCsomTools(makeBridge({ addTask }));

    await invoke(findTool(allTools, "add_task"), { name: "Filter" }).catch(
      () => undefined,
    );

    expect(addTask).not.toHaveBeenCalled();
  });

  it("add_task refuses a component with nothing that runs it", async () => {
    const addTask = vi.fn();
    const { allTools } = createCsomTools(makeBridge({ addTask }));

    await invoke(findTool(allTools, "add_task"), {
      name: "greet",
      componentRef: {
        name: "Hello greeting",
        url: null,
        spec: {
          name: "Hello greeting",
          inputs: [{ name: "name", type: "String" }],
          outputs: [{ name: "greeting", type: "String" }],
          implementation: {},
        },
      },
    }).catch(() => undefined);

    expect(addTask).not.toHaveBeenCalled();
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
  });

  /**
   * Strict mode rewrites every object to `additionalProperties: false`, so a
   * field whose content lives only in `additionalProperties` can hold nothing
   * but `{}` — which is what `implementation` was, and why the editor agent
   * added and deleted the same task until its turn ran out. Every key an agent
   * has to fill must be a named property.
   */
  it("add_task implementation keys survive strict mode", () => {
    const { allTools } = createCsomTools(makeBridge());
    const addTaskTool = findTool(allTools, "add_task");

    const objectBranch = getImplementationAnyOf(
      addTaskTool.parameters as JsonSchemaNode,
    ).find((entry) => entry.type === "object");

    const container = objectBranch?.properties?.container;
    expect(Object.keys(container?.properties ?? {})).toEqual(
      expect.arrayContaining(["image", "command"]),
    );
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

  it("set_task_argument accepts graph input and task output argument objects", async () => {
    const setTaskArgument = vi.fn().mockResolvedValue({ success: true });
    const { allTools } = createCsomTools(makeBridge({ setTaskArgument }));

    await invoke(findTool(allTools, "set_task_argument"), {
      taskEntityId: "task_1",
      inputName: "path",
      value: { graphInput: { inputName: "dataset" } },
    });
    await invoke(findTool(allTools, "set_task_argument"), {
      taskEntityId: "task_2",
      inputName: "model",
      value: { taskOutput: { taskId: "train", outputName: "model" } },
    });

    expect(setTaskArgument).toHaveBeenNthCalledWith(1, "task_1", "path", {
      graphInput: { inputName: "dataset" },
    });
    expect(setTaskArgument).toHaveBeenNthCalledWith(2, "task_2", "model", {
      taskOutput: { taskId: "train", outputName: "model" },
    });
  });

  it("set_task_argument schema avoids recursive allOf shapes rejected by Responses", () => {
    const { allTools } = createCsomTools(makeBridge());
    const setTaskArgumentTool = findTool(allTools, "set_task_argument");
    const valueSchema = (setTaskArgumentTool.parameters as JsonSchemaNode)
      .properties?.value;

    expect(valueSchema?.anyOf).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "string" }),
        expect.objectContaining({ type: "object" }),
      ]),
    );
    expect(hasAllOf(valueSchema)).toBe(false);
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

  it("add_sticky_note normalizes null optional fields to undefined", async () => {
    const addStickyNote = vi
      .fn()
      .mockResolvedValue({ success: true, stickyNoteId: "flex_1" });
    const { allTools } = createCsomTools(makeBridge({ addStickyNote }));

    await invoke(findTool(allTools, "add_sticky_note"), {
      title: "Careful",
      content: null,
      color: "#FFF9C4",
      borderColor: null,
      size: null,
      position: null,
      anchorEntityId: "task_1",
      inSubgraphTaskId: null,
    });

    expect(addStickyNote).toHaveBeenCalledWith({
      title: "Careful",
      content: undefined,
      color: "#FFF9C4",
      borderColor: undefined,
      size: undefined,
      position: undefined,
      anchorEntityId: "task_1",
      inSubgraphTaskId: undefined,
    });
  });

  it("update_sticky_note forwards (noteId, updates) in the right order", async () => {
    const updateStickyNote = vi.fn().mockResolvedValue({ success: true });
    const { allTools } = createCsomTools(makeBridge({ updateStickyNote }));

    await invoke(findTool(allTools, "update_sticky_note"), {
      noteId: "flex_1",
      content: "Revised",
      locked: false,
    });

    expect(updateStickyNote).toHaveBeenCalledWith(
      "flex_1",
      expect.objectContaining({ content: "Revised", locked: false }),
    );
  });

  it("set_task_color forwards (taskEntityIds, color) in the right order", async () => {
    const setTaskColor = vi.fn().mockResolvedValue({ success: true });
    const { allTools } = createCsomTools(makeBridge({ setTaskColor }));

    await invoke(findTool(allTools, "set_task_color"), {
      taskEntityIds: ["task_1", "task_2"],
      color: "#C8E6C9",
    });

    expect(setTaskColor).toHaveBeenCalledWith(["task_1", "task_2"], "#C8E6C9");
  });

  it("update_input keeps an explicit empty string as a clear instruction", async () => {
    const updateInput = vi.fn().mockResolvedValue({ success: true });
    const { allTools } = createCsomTools(makeBridge({ updateInput }));

    await invoke(findTool(allTools, "update_input"), {
      entityId: "input_1",
      type: "Integer",
      description: "",
      defaultValue: null,
      optional: false,
    });

    expect(updateInput).toHaveBeenCalledWith("input_1", {
      type: "Integer",
      description: "",
      defaultValue: undefined,
      optional: false,
    });
  });

  it("update_output forwards (entityId, updates) in the right order", async () => {
    const updateOutput = vi.fn().mockResolvedValue({ success: true });
    const { allTools } = createCsomTools(makeBridge({ updateOutput }));

    await invoke(findTool(allTools, "update_output"), {
      entityId: "output_1",
      type: "String",
      description: null,
    });

    expect(updateOutput).toHaveBeenCalledWith("output_1", {
      type: "String",
      description: undefined,
    });
  });

  it("move_node forwards (entityId, position) in the right order", async () => {
    const moveNode = vi.fn().mockResolvedValue({ success: true });
    const { allTools } = createCsomTools(makeBridge({ moveNode }));

    await invoke(findTool(allTools, "move_node"), {
      entityId: "task_1",
      position: { x: 10, y: 20 },
    });

    expect(moveNode).toHaveBeenCalledWith("task_1", { x: 10, y: 20 });
  });

  it("auto_layout normalizes a null algorithm to undefined", async () => {
    const autoLayout = vi.fn().mockResolvedValue({ success: true });
    const { allTools } = createCsomTools(makeBridge({ autoLayout }));

    await invoke(findTool(allTools, "auto_layout"), { algorithm: null });

    expect(autoLayout).toHaveBeenCalledWith(undefined);
  });

  it("delete_sticky_note forwards the note id", async () => {
    const deleteStickyNote = vi.fn().mockResolvedValue({ success: true });
    const { allTools } = createCsomTools(makeBridge({ deleteStickyNote }));

    await invoke(findTool(allTools, "delete_sticky_note"), {
      noteId: "flex_1",
    });

    expect(deleteStickyNote).toHaveBeenCalledWith("flex_1");
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
