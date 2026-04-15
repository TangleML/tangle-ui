/**
 * CSOM (Component Spec Object Model) tools for LangChain agents.
 *
 * These tools wrap the CSOM actions from src/models/componentSpec/ so the
 * Pipeline Architect agent can manipulate pipeline graphs via structured
 * tool calls.
 *
 * All tools are created per-request via `createCsomTools(session)` so that
 * concurrent requests each operate on their own isolated spec / id generator.
 */
import { tool } from "@langchain/core/tools";
import { z } from "zod";

import type {
  ComponentReference,
  ComponentSpecJson,
} from "@/models/componentSpec";
import {
  Binding,
  ComponentSpec,
  createSubgraph,
  createTaskFromComponentRef,
  Input,
  Output,
  Task,
  unpackSubgraph,
  YamlDeserializer,
} from "@/models/componentSpec";
import { validateSpec } from "@/models/componentSpec/validation/validateSpec";
import { serializeSpecForAi } from "@/routes/v2/pages/Editor/components/AiChat/serializeSpecForAi";

import type { AgentSession } from "../session";
import { recordCommand } from "../session";

// ---------------------------------------------------------------------------
// Spec loading helpers (pure functions — no globals)
// ---------------------------------------------------------------------------

interface AiSpecJson {
  name: string;
  description?: string;
  inputs?: Array<{
    $id?: string;
    name: string;
    type?: string;
    description?: string;
    default?: string;
    optional?: boolean;
  }>;
  outputs?: Array<{
    $id?: string;
    name: string;
    type?: string;
    description?: string;
  }>;
  tasks?: Array<{
    $id?: string;
    name: string;
    componentRef: ComponentReference;
    arguments?: Array<{ name: string; value?: unknown }>;
  }>;
  bindings?: Array<{
    $id?: string;
    sourceEntityId: string;
    sourcePortName: string;
    targetEntityId: string;
    targetPortName: string;
  }>;
}

function buildSpecFromAiJson(
  json: Record<string, unknown>,
  session: AgentSession,
): ComponentSpec {
  const ai = json as unknown as AiSpecJson;

  const inputs = (ai.inputs ?? []).map(
    (i) =>
      new Input({
        $id: i.$id ?? session.idGen.next("input"),
        name: i.name,
        type: i.type,
        description: i.description,
        defaultValue: i.default,
        optional: i.optional,
      }),
  );

  const outputs = (ai.outputs ?? []).map(
    (o) =>
      new Output({
        $id: o.$id ?? session.idGen.next("output"),
        name: o.name,
        type: o.type,
        description: o.description,
      }),
  );

  const tasks = (ai.tasks ?? []).map((t) => {
    const task = new Task({
      $id: t.$id ?? session.idGen.next("task"),
      name: t.name,
      componentRef: t.componentRef,
      arguments: (t.arguments ?? []).map((a) => ({
        name: a.name,
        value: a.value as string | undefined,
      })),
    });
    return task;
  });

  const bindings = (ai.bindings ?? []).map(
    (b) =>
      new Binding({
        $id: b.$id ?? session.idGen.next("binding"),
        sourceEntityId: b.sourceEntityId,
        sourcePortName: b.sourcePortName,
        targetEntityId: b.targetEntityId,
        targetPortName: b.targetPortName,
      }),
  );

  return new ComponentSpec({
    name: ai.name,
    description: ai.description,
    inputs,
    outputs,
    tasks,
    bindings,
  });
}

/**
 * Load an AiSpec (the simplified flat format the UI sends) into the
 * session's ComponentSpec. Detects the format by checking whether `tasks`
 * is an array (AiSpec) vs the full ComponentSpecJson that has
 * `implementation.graph`.
 */
export function loadSpecFromAiSpec(
  json: Record<string, unknown>,
  session: AgentSession,
): void {
  if (Array.isArray(json.tasks)) {
    session.spec = buildSpecFromAiJson(json, session);
    return;
  }
  const deserializer = new YamlDeserializer(session.idGen);
  session.spec = deserializer.deserialize(json as unknown as ComponentSpecJson);
}

// ---------------------------------------------------------------------------
// Tool factory — creates tools bound to a specific session
// ---------------------------------------------------------------------------

export function createCsomTools(session: AgentSession) {
  function serializeActive(): string {
    return JSON.stringify(serializeSpecForAi(session.spec), null, 2);
  }

  const getPipelineState = tool(async () => serializeActive(), {
    name: "get_pipeline_state",
    description:
      "Get the current pipeline spec as JSON. Call this first to understand what exists.",
    schema: z.object({}),
  });

  const setPipelineName = tool(
    async ({ name }: { name: string }) => {
      session.spec.setName(name);
      recordCommand(session, { op: "setName", params: { name } });
      return JSON.stringify({ success: true, name });
    },
    {
      name: "set_pipeline_name",
      description: "Set the pipeline name.",
      schema: z.object({ name: z.string().describe("New pipeline name") }),
    },
  );

  const setPipelineDescription = tool(
    async ({ description }: { description: string }) => {
      session.spec.setDescription(description);
      recordCommand(session, { op: "setDescription", params: { description } });
      return JSON.stringify({ success: true, description });
    },
    {
      name: "set_pipeline_description",
      description: "Set the pipeline description.",
      schema: z.object({
        description: z.string().describe("New pipeline description"),
      }),
    },
  );

  const addTask = tool(
    async ({
      name,
      wrappedComponentKey,
      componentRef,
    }: {
      name: string;
      wrappedComponentKey?: string;
      componentRef?: ComponentReference;
    }) => {
      let resolvedRef: ComponentReference;

      if (wrappedComponentKey) {
        const wrapped = session.wrappedComponents.get(wrappedComponentKey);
        if (!wrapped) {
          return JSON.stringify({
            success: false,
            error: `No wrapped component found for key "${wrappedComponentKey}". Call wrap_python_to_yaml first.`,
          });
        }
        resolvedRef = { name: wrappedComponentKey, spec: wrapped.parsed };
      } else if (componentRef) {
        resolvedRef = componentRef;
      } else {
        return JSON.stringify({
          success: false,
          error:
            "Provide either wrappedComponentKey (from wrap_python_to_yaml) or componentRef.",
        });
      }

      const task = createTaskFromComponentRef(session.idGen, resolvedRef, name);
      session.spec.addTask(task);
      recordCommand(session, {
        op: "addTask",
        params: { componentRef: resolvedRef, tempId: task.$id },
      });
      return JSON.stringify({
        success: true,
        taskId: task.$id,
        name: task.name,
      });
    },
    {
      name: "add_task",
      description:
        "Add a new task node to the pipeline. Use wrappedComponentKey (from wrap_python_to_yaml) " +
        "for custom components, or componentRef with a url for registry components.",
      schema: z.object({
        name: z.string().describe("Human-readable task name"),
        wrappedComponentKey: z
          .string()
          .optional()
          .describe(
            "Key returned by wrap_python_to_yaml. The full spec is loaded automatically — do not pass componentRef when using this.",
          ),
        componentRef: z
          .object({
            name: z.string(),
            url: z.string().optional(),
            spec: z
              .object({
                name: z.string(),
                description: z.string().optional(),
                inputs: z
                  .array(
                    z.object({
                      name: z.string(),
                      type: z.string().optional(),
                      description: z.string().optional(),
                      default: z.string().optional(),
                      optional: z.boolean().optional(),
                    }),
                  )
                  .optional(),
                outputs: z
                  .array(
                    z.object({
                      name: z.string(),
                      type: z.string().optional(),
                      description: z.string().optional(),
                    }),
                  )
                  .optional(),
                implementation: z.record(z.string(), z.unknown()).optional(),
              })
              .optional(),
          })
          .optional()
          .describe(
            "Component reference with embedded spec. Use for registry components or when wrappedComponentKey is not available.",
          ),
      }),
    },
  );

  const deleteTask = tool(
    async ({ entityId }: { entityId: string }) => {
      const deleted = session.spec.deleteTaskById(entityId);
      if (deleted)
        recordCommand(session, { op: "deleteTask", params: { entityId } });
      return JSON.stringify({ success: deleted, entityId });
    },
    {
      name: "delete_task",
      description: "Delete a task and all its connections by $id.",
      schema: z.object({
        entityId: z.string().describe("The $id of the task to delete"),
      }),
    },
  );

  const renameTask = tool(
    async ({ entityId, newName }: { entityId: string; newName: string }) => {
      const success = session.spec.renameTask(entityId, newName);
      if (success)
        recordCommand(session, {
          op: "renameTask",
          params: { entityId, newName },
        });
      return JSON.stringify({ success, entityId, newName });
    },
    {
      name: "rename_task",
      description: "Rename a task.",
      schema: z.object({
        entityId: z.string().describe("The $id of the task"),
        newName: z.string().describe("New task name"),
      }),
    },
  );

  const addInput = tool(
    async ({
      name,
      type,
      description,
      defaultValue,
      optional,
    }: {
      name: string;
      type?: string;
      description?: string;
      defaultValue?: string;
      optional?: boolean;
    }) => {
      const input = new Input({
        $id: session.idGen.next("input"),
        name,
        type,
        description,
        defaultValue,
        optional,
      });
      session.spec.addInput(input);
      recordCommand(session, {
        op: "addInput",
        params: {
          name,
          ...(type && { type }),
          ...(description && { description }),
          ...(defaultValue && { default: defaultValue }),
          ...(optional !== undefined && { optional }),
          tempId: input.$id,
        },
      });
      return JSON.stringify({ success: true, inputId: input.$id, name });
    },
    {
      name: "add_input",
      description: "Add a pipeline-level input.",
      schema: z.object({
        name: z.string().describe("Input name"),
        type: z
          .string()
          .optional()
          .describe("Type (e.g. String, Integer, Float)"),
        description: z.string().optional(),
        defaultValue: z.string().optional().describe("Default value"),
        optional: z.boolean().optional(),
      }),
    },
  );

  const deleteInput = tool(
    async ({ entityId }: { entityId: string }) => {
      const deleted = session.spec.deleteInputById(entityId);
      if (deleted)
        recordCommand(session, { op: "deleteInput", params: { entityId } });
      return JSON.stringify({ success: deleted, entityId });
    },
    {
      name: "delete_input",
      description: "Delete a pipeline input and its connections.",
      schema: z.object({
        entityId: z.string().describe("The $id of the input to delete"),
      }),
    },
  );

  const renameInput = tool(
    async ({ entityId, newName }: { entityId: string; newName: string }) => {
      const success = session.spec.renameInput(entityId, newName);
      if (success)
        recordCommand(session, {
          op: "renameInput",
          params: { entityId, newName },
        });
      return JSON.stringify({ success, entityId, newName });
    },
    {
      name: "rename_input",
      description: "Rename a pipeline input.",
      schema: z.object({
        entityId: z.string().describe("The $id of the input"),
        newName: z.string().describe("New input name"),
      }),
    },
  );

  const addOutput = tool(
    async ({
      name,
      type,
      description,
    }: {
      name: string;
      type?: string;
      description?: string;
    }) => {
      const output = new Output({
        $id: session.idGen.next("output"),
        name,
        type,
        description,
      });
      session.spec.addOutput(output);
      recordCommand(session, {
        op: "addOutput",
        params: {
          name,
          ...(type && { type }),
          ...(description && { description }),
          tempId: output.$id,
        },
      });
      return JSON.stringify({ success: true, outputId: output.$id, name });
    },
    {
      name: "add_output",
      description: "Add a pipeline-level output.",
      schema: z.object({
        name: z.string().describe("Output name"),
        type: z.string().optional().describe("Type"),
        description: z.string().optional(),
      }),
    },
  );

  const deleteOutput = tool(
    async ({ entityId }: { entityId: string }) => {
      const deleted = session.spec.deleteOutputById(entityId);
      if (deleted)
        recordCommand(session, { op: "deleteOutput", params: { entityId } });
      return JSON.stringify({ success: deleted, entityId });
    },
    {
      name: "delete_output",
      description: "Delete a pipeline output and its connections.",
      schema: z.object({
        entityId: z.string().describe("The $id of the output to delete"),
      }),
    },
  );

  const renameOutput = tool(
    async ({ entityId, newName }: { entityId: string; newName: string }) => {
      const success = session.spec.renameOutput(entityId, newName);
      if (success)
        recordCommand(session, {
          op: "renameOutput",
          params: { entityId, newName },
        });
      return JSON.stringify({ success, entityId, newName });
    },
    {
      name: "rename_output",
      description: "Rename a pipeline output.",
      schema: z.object({
        entityId: z.string().describe("The $id of the output"),
        newName: z.string().describe("New output name"),
      }),
    },
  );

  const connectNodes = tool(
    async ({
      sourceEntityId,
      sourcePortName,
      targetEntityId,
      targetPortName,
    }: {
      sourceEntityId: string;
      sourcePortName: string;
      targetEntityId: string;
      targetPortName: string;
    }) => {
      const binding = session.spec.connectNodes(
        { entityId: sourceEntityId, portName: sourcePortName },
        { entityId: targetEntityId, portName: targetPortName },
      );
      recordCommand(session, {
        op: "connectNodes",
        params: {
          source: { entityId: sourceEntityId, portName: sourcePortName },
          target: { entityId: targetEntityId, portName: targetPortName },
        },
      });
      return JSON.stringify({
        success: true,
        bindingId: binding.$id,
      });
    },
    {
      name: "connect_nodes",
      description:
        "Connect an output port of one entity to an input port of another. Replaces any existing connection to the target port.",
      schema: z.object({
        sourceEntityId: z
          .string()
          .describe("$id of source entity (task or pipeline input)"),
        sourcePortName: z.string().describe("Name of the source port"),
        targetEntityId: z
          .string()
          .describe("$id of target entity (task or pipeline output)"),
        targetPortName: z.string().describe("Name of the target port"),
      }),
    },
  );

  const deleteEdge = tool(
    async ({ entityId }: { entityId: string }) => {
      const deleted = session.spec.deleteEdgeById(entityId);
      if (deleted)
        recordCommand(session, { op: "deleteEdge", params: { entityId } });
      return JSON.stringify({ success: deleted, entityId });
    },
    {
      name: "delete_edge",
      description: "Delete a binding/edge by its $id.",
      schema: z.object({
        entityId: z.string().describe("The $id of the binding to delete"),
      }),
    },
  );

  const setTaskArgument = tool(
    async ({
      taskEntityId,
      inputName,
      value,
    }: {
      taskEntityId: string;
      inputName: string;
      value: string;
    }) => {
      session.spec.setTaskArgument(taskEntityId, inputName, value);
      recordCommand(session, {
        op: "setTaskArgument",
        params: { taskEntityId, inputName, value },
      });
      return JSON.stringify({ success: true, taskEntityId, inputName, value });
    },
    {
      name: "set_task_argument",
      description:
        "Set a literal value for a task input. Removes any existing connection to that port.",
      schema: z.object({
        taskEntityId: z.string().describe("$id of the task"),
        inputName: z.string().describe("Name of the input port"),
        value: z.string().describe("Literal string value"),
      }),
    },
  );

  const createSubgraphTool = tool(
    async ({
      taskEntityIds,
      subgraphName,
    }: {
      taskEntityIds: string[];
      subgraphName: string;
    }) => {
      const result = createSubgraph({
        spec: session.spec,
        selectedTaskIds: taskEntityIds,
        subgraphName,
        idGen: session.idGen,
      });
      if (!result) {
        return JSON.stringify({ success: false, error: "No tasks matched" });
      }
      recordCommand(session, {
        op: "createSubgraph",
        params: { taskEntityIds, subgraphName },
      });
      return JSON.stringify({
        success: true,
        subgraphTaskId: result.replacementTask.$id,
        subgraphName,
      });
    },
    {
      name: "create_subgraph",
      description:
        "Group 2 or more related tasks into a subgraph. NEVER use for a single task — only group tasks that form a logical unit of work together.",
      schema: z.object({
        taskEntityIds: z.array(z.string()).describe("$ids of tasks to group"),
        subgraphName: z.string().describe("Name for the subgraph"),
      }),
    },
  );

  const unpackSubgraphTool = tool(
    async ({ taskEntityId }: { taskEntityId: string }) => {
      const success = unpackSubgraph({
        spec: session.spec,
        taskId: taskEntityId,
        idGen: session.idGen,
      });
      if (success)
        recordCommand(session, {
          op: "unpackSubgraph",
          params: { taskEntityId },
        });
      return JSON.stringify({ success, taskEntityId });
    },
    {
      name: "unpack_subgraph",
      description:
        "Inline a subgraph task back into the parent pipeline, expanding its inner tasks.",
      schema: z.object({
        taskEntityId: z.string().describe("$id of the subgraph task to unpack"),
      }),
    },
  );

  const validatePipeline = tool(
    async () => {
      const issues = validateSpec(session.spec);
      return JSON.stringify({
        valid: issues.length === 0,
        issueCount: issues.length,
        issues: issues.map((i) => ({
          type: i.type,
          severity: i.severity,
          message: i.message,
          entityId: i.entityId,
          issueCode: i.issueCode,
        })),
      });
    },
    {
      name: "validate_pipeline",
      description:
        "Validate the current pipeline for schema errors, missing inputs, orphaned bindings, and cycles. Always call before finalizing.",
      schema: z.object({}),
    },
  );

  return {
    getPipelineState,
    allTools: [
      getPipelineState,
      setPipelineName,
      setPipelineDescription,
      addTask,
      deleteTask,
      renameTask,
      addInput,
      deleteInput,
      renameInput,
      addOutput,
      deleteOutput,
      renameOutput,
      connectNodes,
      deleteEdge,
      setTaskArgument,
      createSubgraphTool,
      unpackSubgraphTool,
      validatePipeline,
    ],
  };
}
