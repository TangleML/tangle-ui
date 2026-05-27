/**
 * CSOM tools for the in-browser agent.
 *
 * Each tool is a thin OpenAI Agents `tool()` wrapper around a method on
 * the Comlink-proxied `ToolBridgeApi`. The bridge runs on the main
 * thread and mutates the live MobX `ComponentSpec` inside an undo
 * group, so the agent's edits are immediately reflected in the editor
 * and undoable as a single user action.
 *
 * Schema note: OpenAI's structured-outputs strict mode requires every
 * Zod field to be required or `.nullable().optional()` — `.optional()`
 * alone is rejected. The model passes `null` for fields it wants to
 * omit; the execute functions normalize `null` to `undefined` before
 * handing data to the bridge, since the bridge contract uses `T?`.
 */
import { tool } from "@openai/agents";
import { z } from "zod";

import type { ComponentReference } from "@/models/componentSpec";

import type { ToolBridgeApi } from "../toolBridgeApi";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

function asJson(value: unknown): string {
  return JSON.stringify(value);
}

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.object({}).catchall(jsonValueSchema),
  ]),
);

const arbitraryObjectSchema = z.object({}).catchall(jsonValueSchema);

/**
 * Recursively strips `null` values from an object so the bridge contract
 * (which uses `T?` for optional fields) sees missing keys instead of
 * explicit nulls. Used for the nested `componentRef` payload in
 * `add_task`.
 */
function dropNulls<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, v: unknown) => (v === null ? undefined : v)),
  ) as T;
}

export function createCsomTools(bridge: ToolBridgeApi) {
  const getPipelineState = tool({
    name: "get_pipeline_state",
    description:
      "Get the current pipeline spec as JSON. Call this first to understand what exists.",
    parameters: z.object({}),
    execute: async () => asJson(await bridge.getPipelineState()),
  });

  const setPipelineName = tool({
    name: "set_pipeline_name",
    description: "Set the pipeline name.",
    parameters: z.object({ name: z.string().describe("New pipeline name") }),
    execute: async ({ name }) => asJson(await bridge.setPipelineName(name)),
  });

  const setPipelineDescription = tool({
    name: "set_pipeline_description",
    description: "Set the pipeline description.",
    parameters: z.object({
      description: z.string().describe("New pipeline description"),
    }),
    execute: async ({ description }) =>
      asJson(await bridge.setPipelineDescription(description)),
  });

  const addTask = tool({
    name: "add_task",
    description:
      "Add a new task node to the pipeline. Pass the full componentRef from a search_components result (with `url` and/or `spec`).",
    parameters: z.object({
      name: z.string().describe("Human-readable task name"),
      componentRef: z
        .object({
          name: z.string(),
          url: z.string().nullable().optional(),
          spec: z
            .object({
              name: z.string(),
              description: z.string().nullable().optional(),
              inputs: z
                .array(
                  z.object({
                    name: z.string(),
                    type: z.string().nullable().optional(),
                    description: z.string().nullable().optional(),
                    default: z.string().nullable().optional(),
                    optional: z.boolean().nullable().optional(),
                  }),
                )
                .nullable()
                .optional(),
              outputs: z
                .array(
                  z.object({
                    name: z.string(),
                    type: z.string().nullable().optional(),
                    description: z.string().nullable().optional(),
                  }),
                )
                .nullable()
                .optional(),
              // `z.record(z.string(), …)` emits `propertyNames` in its JSON
              // Schema, which OpenAI's strict mode rejects at tool registration
              // (failing every request routed to this agent before the model
              // ever runs). Keep the field opaque; the bridge accepts arbitrary
              // implementation shapes, but force an explicit object type so
              // strict JSON Schema validation does not see typeless `anyOf`.
              implementation: arbitraryObjectSchema.nullable().optional(),
            })
            .nullable()
            .optional(),
        })
        .describe(
          "Component reference from search_components — must include url and/or spec.",
        ),
    }),
    execute: async ({ name, componentRef }) =>
      asJson(
        await bridge.addTask({
          name,
          componentRef: dropNulls(componentRef) as ComponentReference,
        }),
      ),
  });

  const deleteTask = tool({
    name: "delete_task",
    description: "Delete a task and all its connections by $id.",
    parameters: z.object({
      entityId: z.string().describe("The $id of the task to delete"),
    }),
    execute: async ({ entityId }) => asJson(await bridge.deleteTask(entityId)),
  });

  const renameTask = tool({
    name: "rename_task",
    description: "Rename a task.",
    parameters: z.object({
      entityId: z.string().describe("The $id of the task"),
      newName: z.string().describe("New task name"),
    }),
    execute: async ({ entityId, newName }) =>
      asJson(await bridge.renameTask(entityId, newName)),
  });

  const addInput = tool({
    name: "add_input",
    description: "Add a pipeline-level input.",
    parameters: z.object({
      name: z.string().describe("Input name"),
      type: z
        .string()
        .nullable()
        .optional()
        .describe("Type (e.g. String, Integer, Float)"),
      description: z.string().nullable().optional(),
      defaultValue: z.string().nullable().optional().describe("Default value"),
      optional: z.boolean().nullable().optional(),
    }),
    execute: async ({ name, type, description, defaultValue, optional }) =>
      asJson(
        await bridge.addInput({
          name,
          type: type ?? undefined,
          description: description ?? undefined,
          defaultValue: defaultValue ?? undefined,
          optional: optional ?? undefined,
        }),
      ),
  });

  const deleteInput = tool({
    name: "delete_input",
    description: "Delete a pipeline input and its connections.",
    parameters: z.object({
      entityId: z.string().describe("The $id of the input to delete"),
    }),
    execute: async ({ entityId }) => asJson(await bridge.deleteInput(entityId)),
  });

  const renameInput = tool({
    name: "rename_input",
    description: "Rename a pipeline input.",
    parameters: z.object({
      entityId: z.string().describe("The $id of the input"),
      newName: z.string().describe("New input name"),
    }),
    execute: async ({ entityId, newName }) =>
      asJson(await bridge.renameInput(entityId, newName)),
  });

  const addOutput = tool({
    name: "add_output",
    description: "Add a pipeline-level output.",
    parameters: z.object({
      name: z.string().describe("Output name"),
      type: z.string().nullable().optional().describe("Type"),
      description: z.string().nullable().optional(),
    }),
    execute: async ({ name, type, description }) =>
      asJson(
        await bridge.addOutput({
          name,
          type: type ?? undefined,
          description: description ?? undefined,
        }),
      ),
  });

  const deleteOutput = tool({
    name: "delete_output",
    description: "Delete a pipeline output and its connections.",
    parameters: z.object({
      entityId: z.string().describe("The $id of the output to delete"),
    }),
    execute: async ({ entityId }) =>
      asJson(await bridge.deleteOutput(entityId)),
  });

  const renameOutput = tool({
    name: "rename_output",
    description: "Rename a pipeline output.",
    parameters: z.object({
      entityId: z.string().describe("The $id of the output"),
      newName: z.string().describe("New output name"),
    }),
    execute: async ({ entityId, newName }) =>
      asJson(await bridge.renameOutput(entityId, newName)),
  });

  const connectNodes = tool({
    name: "connect_nodes",
    description:
      "Connect an output port of one entity to an input port of another. Replaces any existing connection to the target port.",
    parameters: z.object({
      sourceEntityId: z
        .string()
        .describe("$id of source entity (task or pipeline input)"),
      sourcePortName: z.string().describe("Name of the source port"),
      targetEntityId: z
        .string()
        .describe("$id of target entity (task or pipeline output)"),
      targetPortName: z.string().describe("Name of the target port"),
    }),
    execute: async ({
      sourceEntityId,
      sourcePortName,
      targetEntityId,
      targetPortName,
    }) =>
      asJson(
        await bridge.connectNodes({
          sourceEntityId,
          sourcePortName,
          targetEntityId,
          targetPortName,
        }),
      ),
  });

  const deleteEdge = tool({
    name: "delete_edge",
    description: "Delete a binding/edge by its $id.",
    parameters: z.object({
      entityId: z.string().describe("The $id of the binding to delete"),
    }),
    execute: async ({ entityId }) => asJson(await bridge.deleteEdge(entityId)),
  });

  const setTaskArgument = tool({
    name: "set_task_argument",
    description:
      "Set a literal value for a task input. Removes any existing connection to that port.",
    parameters: z.object({
      taskEntityId: z.string().describe("$id of the task"),
      inputName: z.string().describe("Name of the input port"),
      value: z.string().describe("Literal string value"),
    }),
    execute: async ({ taskEntityId, inputName, value }) =>
      asJson(await bridge.setTaskArgument(taskEntityId, inputName, value)),
  });

  const createSubgraph = tool({
    name: "create_subgraph",
    description:
      "Group 2 or more related tasks into a subgraph. NEVER use for a single task — only group tasks that form a logical unit of work together.",
    parameters: z.object({
      taskEntityIds: z.array(z.string()).describe("$ids of tasks to group"),
      subgraphName: z.string().describe("Name for the subgraph"),
    }),
    execute: async ({ taskEntityIds, subgraphName }) =>
      asJson(await bridge.createSubgraph(taskEntityIds, subgraphName)),
  });

  const unpackSubgraph = tool({
    name: "unpack_subgraph",
    description:
      "Inline a subgraph task back into the parent pipeline, expanding its inner tasks.",
    parameters: z.object({
      taskEntityId: z.string().describe("$id of the subgraph task to unpack"),
    }),
    execute: async ({ taskEntityId }) =>
      asJson(await bridge.unpackSubgraph(taskEntityId)),
  });

  const validatePipeline = tool({
    name: "validate_pipeline",
    description:
      "Validate the current pipeline for schema errors, missing inputs, orphaned bindings, and cycles. Always call before finalizing.",
    parameters: z.object({}),
    execute: async () => asJson(await bridge.validatePipeline()),
  });

  return {
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
      createSubgraph,
      unpackSubgraph,
      validatePipeline,
    ],
  };
}
