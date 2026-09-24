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

import {
  DEFAULT_FLEX_NODE_SIZE,
  MIN_FLEX_NODE_SIZE,
} from "@/components/shared/ReactFlow/FlowCanvas/FlexNode/utils";
import { PRESET_COLORS } from "@/components/ui/colorPresets";
import type { ArgumentType, ComponentReference } from "@/models/componentSpec";

import type { ToolBridgeApi } from "../toolBridgeApi";

type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

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
 * `implementation` cannot be an open object. OpenAI's strict mode rewrites
 * every `type: "object"` to `additionalProperties: false`, so a catchall
 * permits exactly one value — `{}` — and the model cannot say what runs no
 * matter how it is prompted. Every key has to be spelled out to be reachable.
 */
const commandArgumentSchema = z.union([
  z.string(),
  z.object({ inputValue: z.string() }),
  z.object({ inputPath: z.string() }),
  z.object({ outputPath: z.string() }),
]);

const containerImplementationSchema = z.object({
  container: z.object({
    image: z
      .string()
      .describe(
        "Container image to run, e.g. `python:3.11-slim`. Pick one that already has what the command needs.",
      ),
    command: z
      .array(commandArgumentSchema)
      .nullable()
      .optional()
      .describe(
        'Executable and its arguments, run without a shell; null falls back to the image\'s own ENTRYPOINT. An input reaches it as {"inputValue": "<input name>"} for the value itself or {"inputPath": "<input name>"} for a file holding it; an output is a file the command must write at {"outputPath": "<output name>"}, creating parent directories first.',
      ),
    args: z.array(commandArgumentSchema).nullable().optional(),
  }),
});

const argumentValueSchema = z.union([
  z.string(),
  z.object({
    graphInput: z.object({
      inputName: z.string(),
      type: z.string().nullable().optional(),
    }),
  }),
  z.object({
    taskOutput: z.object({
      taskId: z
        .string()
        .describe(
          "The source task's $id or its name — both are accepted. The referenced task must live in the same graph as the task being written to.",
        ),
      outputName: z.string(),
      type: z.string().nullable().optional(),
    }),
  }),
  z.object({
    // `DynamicDataValue` is `SecretArgument | SystemDataArgument`. The secret
    // shape is spelled out so the model has a concrete target; system sources
    // use arbitrary string keys (e.g. `{ "system/multi_node/node_index": {} }`)
    // and go through the catchall object. `z.record` is intentionally avoided
    // here for the same reason as `implementation` below — it emits
    // `propertyNames`, which OpenAI strict mode rejects at tool registration.
    dynamicData: z.union([
      z.object({ secret: z.object({ name: z.string() }) }),
      arbitraryObjectSchema,
    ]),
  }),
]);

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

const COLOR_GUIDANCE = `Hex value or "transparent". The swatches the UI offers are ${PRESET_COLORS.join(", ")} — prefer one of those, so what you colour matches what the user coloured by hand.`;

const SIZE_GUIDANCE = `No smaller than ${MIN_FLEX_NODE_SIZE.width}x${MIN_FLEX_NODE_SIZE.height} — a note below that is too small to read or select, and is refused.`;

const EXPECTED_GRAPH_GUIDANCE =
  "Which graph you mean this edit for: the `activeSubgraphTaskId` from your last `get_pipeline_state`, or null if it reported none. This field addresses the graph the user is viewing rather than an `$id`, so the edit is refused if they have moved elsewhere since — read the state again and redo it, never guess.";

const positionSchema = z.object({ x: z.number(), y: z.number() });
const sizeSchema = z.object({ width: z.number(), height: z.number() });

export function createCsomTools(bridge: ToolBridgeApi) {
  const getPipelineState = tool({
    name: "get_pipeline_state",
    description:
      "Get the current pipeline spec as JSON. Call this first to understand what exists.",
    parameters: z.object({}),
    execute: async () => asJson(await bridge.getPipelineState()),
  });

  const getSubgraphState = tool({
    name: "get_subgraph_state",
    description:
      "Get the contents of one subgraph task — its inner tasks, bindings, and I/O — as JSON. `get_pipeline_state` reports only a subgraph task's interface, so call this for any task flagged `isSubgraph` before answering questions about what runs inside it. Inner tasks carry the same flag: call again with an inner task's $id to go deeper.",
    parameters: z.object({
      taskEntityId: z
        .string()
        .describe("$id of the subgraph task to look inside"),
    }),
    execute: async ({ taskEntityId }) =>
      asJson(await bridge.getSubgraphState(taskEntityId)),
  });

  const setPipelineName = tool({
    name: "set_pipeline_name",
    description:
      "Set the name of the top-level pipeline. To rename a subgraph, use rename_task on the subgraph task instead.",
    parameters: z.object({ name: z.string().describe("New pipeline name") }),
    execute: async ({ name }) => asJson(await bridge.setPipelineName(name)),
  });

  const setPipelineDescription = tool({
    name: "set_pipeline_description",
    description:
      "Set the description of the top-level pipeline (not of a subgraph).",
    parameters: z.object({
      description: z.string().describe("New pipeline description"),
    }),
    execute: async ({ description }) =>
      asJson(await bridge.setPipelineDescription(description)),
  });

  const setPipelineNotes = tool({
    name: "set_pipeline_notes",
    description:
      "Set the notes on the graph the user is currently viewing — a free-text field for whatever someone needs to know about it, separate from the one-line description. Notes belong to a graph, so this writes the subgraph's notes while the user is inside one, matching what the details panel shows them; `get_pipeline_state` reports that same field. It is the user's own document: read `notes` and preserve what is there, appending rather than replacing, unless they asked you to rewrite it. Pass an empty string to clear it.",
    parameters: z.object({
      notes: z.string().describe("Full new notes text; replaces the existing"),
      expectedSubgraphTaskId: z
        .string()
        .nullable()
        .describe(EXPECTED_GRAPH_GUIDANCE),
    }),
    execute: async ({ notes, expectedSubgraphTaskId }) =>
      asJson(await bridge.setPipelineNotes(notes, expectedSubgraphTaskId)),
  });

  const setPipelineTags = tool({
    name: "set_pipeline_tags",
    description:
      "Set the tags on the graph the user is currently viewing, used to group and find pipelines. This replaces the whole list, so read `tags` from `get_pipeline_state` first and pass the existing ones along with any you add. A tag cannot contain a comma, no tag may repeat, and a graph takes at most 10; the call is refused rather than half-applied. Pass an empty array to clear them.",
    parameters: z.object({
      tags: z
        .array(z.string())
        .describe("The complete tag list; commas are not allowed in a tag"),
      expectedSubgraphTaskId: z
        .string()
        .nullable()
        .describe(EXPECTED_GRAPH_GUIDANCE),
    }),
    execute: async ({ tags, expectedSubgraphTaskId }) =>
      asJson(await bridge.setPipelineTags(tags, expectedSubgraphTaskId)),
  });

  const setRunNameTemplate = tool({
    name: "set_run_name_template",
    description:
      "Set the template that names each run, so runs are identifiable in the run list instead of all sharing the pipeline's name. Applies to the graph the user is currently viewing, like the details panel it mirrors. Placeholders are `${arguments.<input name>}` for a pipeline input's value and `${date.timestamp}` / `${date.short}` / `${date.long}`. An input name must match an input on the graph you are setting this on, or the placeholder is left in the run name verbatim, braces and all — note that `inputs` in `get_pipeline_state` is the top-level pipeline's, so inside a subgraph read that graph's own inputs from `get_subgraph_state` first. A template naming an input the graph does not have is refused. Pass an empty string to clear the template.",
    parameters: z.object({
      template: z
        .string()
        .describe(
          'Template string, e.g. "nightly ${arguments.dataset} ${date.short}"',
        ),
      expectedSubgraphTaskId: z
        .string()
        .nullable()
        .describe(EXPECTED_GRAPH_GUIDANCE),
    }),
    execute: async ({ template, expectedSubgraphTaskId }) =>
      asJson(await bridge.setRunNameTemplate(template, expectedSubgraphTaskId)),
  });

  const addTask = tool({
    name: "add_task",
    description:
      "Add a new task node. Prefer the full componentRef from a search_components result (with `url` and/or `spec`). When nothing in the registry does the job you may author the component inline instead, but then `spec.implementation` is required — a spec with ports and no implementation is added without complaint, validates clean, and is refused by the backend at submit with no indication of which task is at fault. Adds to the top-level pipeline unless inSubgraphTaskId names a subgraph to add it inside.",
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
              implementation: containerImplementationSchema
                .nullable()
                .optional()
                .describe(
                  "How the task actually runs. Required unless `url` is given — a component with ports and nothing to run them is refused at submit. Carry it through verbatim from a search_components result, or write one: an image, and a command that reads each input and writes each output.",
                ),
            })
            .nullable()
            .optional(),
        })
        .refine(
          (ref) => ref.url != null || ref.spec != null,
          "componentRef must include either a url or an inline spec — name alone is not enough",
        )
        .refine(
          (ref) => ref.url != null || ref.spec?.implementation != null,
          "an inline spec must include `implementation` — a component with ports and nothing that runs them is refused at submit, and the refusal cannot say which task it came from",
        )
        .describe(
          "Component reference from search_components — must include url and/or spec.",
        ),
      inSubgraphTaskId: z
        .string()
        .nullable()
        .optional()
        .describe(
          "$id of a subgraph task to add this inside. Omit for the top-level pipeline. When the user means the subgraph they are viewing, pass activeSubgraphTaskId from get_pipeline_state verbatim — a name from activeSubgraphPath is not an $id.",
        ),
    }),
    execute: async ({ name, componentRef, inSubgraphTaskId }) =>
      asJson(
        await bridge.addTask({
          name,
          componentRef: dropNulls(componentRef) as ComponentReference,
          inSubgraphTaskId: inSubgraphTaskId ?? undefined,
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

  const setTaskColor = tool({
    name: "set_task_color",
    description:
      "Colour one or more tasks. Colour is how users group tasks visually — it has no effect on what runs — so read each task's `color` in `get_pipeline_state` before changing anything and do not recolour a task the user coloured themselves unless they asked. Give every task in a group the same colour, and use `transparent` to clear it. Tasks may be in different subgraphs.",
    parameters: z.object({
      taskEntityIds: z.array(z.string()).describe("$ids of the tasks"),
      color: z.string().describe(COLOR_GUIDANCE),
    }),
    execute: async ({ taskEntityIds, color }) =>
      asJson(await bridge.setTaskColor(taskEntityIds, color)),
  });

  const addInput = tool({
    name: "add_input",
    description:
      "Add a graph-level input. Adds to the top-level pipeline unless inSubgraphTaskId names a subgraph to add it inside — a subgraph input becomes an input port on that subgraph task.",
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
      inSubgraphTaskId: z
        .string()
        .nullable()
        .optional()
        .describe(
          "$id of a subgraph task to add this inside. Omit for the top-level pipeline. When the user means the subgraph they are viewing, pass activeSubgraphTaskId from get_pipeline_state verbatim — a name from activeSubgraphPath is not an $id.",
        ),
    }),
    execute: async ({
      name,
      type,
      description,
      defaultValue,
      optional,
      inSubgraphTaskId,
    }) =>
      asJson(
        await bridge.addInput({
          name,
          type: type ?? undefined,
          description: description ?? undefined,
          defaultValue: defaultValue ?? undefined,
          optional: optional ?? undefined,
          inSubgraphTaskId: inSubgraphTaskId ?? undefined,
        }),
      ),
  });

  const deleteInput = tool({
    name: "delete_input",
    description:
      "Delete a graph input and its connections. Works on inputs inside a subgraph too: the matching input port disappears from the subgraph task and any connection feeding it in the parent is removed.",
    parameters: z.object({
      entityId: z.string().describe("The $id of the input to delete"),
    }),
    execute: async ({ entityId }) => asJson(await bridge.deleteInput(entityId)),
  });

  const renameInput = tool({
    name: "rename_input",
    description:
      "Rename a graph input. Works on inputs inside a subgraph too: the matching input port on the subgraph task is renamed with it, so connections in the parent survive.",
    parameters: z.object({
      entityId: z.string().describe("The $id of the input"),
      newName: z.string().describe("New input name"),
    }),
    execute: async ({ entityId, newName }) =>
      asJson(await bridge.renameInput(entityId, newName)),
  });

  const updateInput = tool({
    name: "update_input",
    description:
      "Change an existing graph input's type, description, default value or optional flag, wherever it lives. Only the fields you pass are changed; pass an empty string to clear a text field. Use rename_input for the name. On an input inside a subgraph, the matching port on the subgraph task picks up the new type automatically.",
    parameters: z.object({
      entityId: z.string().describe("The $id of the input"),
      type: z
        .string()
        .nullable()
        .optional()
        .describe("Type (e.g. String, Integer, Float)"),
      description: z.string().nullable().optional(),
      defaultValue: z.string().nullable().optional(),
      optional: z
        .boolean()
        .nullable()
        .optional()
        .describe(
          "An optional input need not be supplied at run time; a required one must be.",
        ),
    }),
    execute: async ({ entityId, type, description, defaultValue, optional }) =>
      asJson(
        await bridge.updateInput(entityId, {
          type: type ?? undefined,
          description: description ?? undefined,
          defaultValue: defaultValue ?? undefined,
          optional: optional ?? undefined,
        }),
      ),
  });

  const addOutput = tool({
    name: "add_output",
    description:
      "Add a graph-level output. Adds to the top-level pipeline unless inSubgraphTaskId names a subgraph to add it inside — a subgraph output becomes an output port on that subgraph task.",
    parameters: z.object({
      name: z.string().describe("Output name"),
      type: z.string().nullable().optional().describe("Type"),
      description: z.string().nullable().optional(),
      inSubgraphTaskId: z
        .string()
        .nullable()
        .optional()
        .describe(
          "$id of a subgraph task to add this inside. Omit for the top-level pipeline. When the user means the subgraph they are viewing, pass activeSubgraphTaskId from get_pipeline_state verbatim — a name from activeSubgraphPath is not an $id.",
        ),
    }),
    execute: async ({ name, type, description, inSubgraphTaskId }) =>
      asJson(
        await bridge.addOutput({
          name,
          type: type ?? undefined,
          description: description ?? undefined,
          inSubgraphTaskId: inSubgraphTaskId ?? undefined,
        }),
      ),
  });

  const deleteOutput = tool({
    name: "delete_output",
    description:
      "Delete a graph output and its connections. Works on outputs inside a subgraph too: the matching output port disappears from the subgraph task and any connection drawing from it in the parent is removed.",
    parameters: z.object({
      entityId: z.string().describe("The $id of the output to delete"),
    }),
    execute: async ({ entityId }) =>
      asJson(await bridge.deleteOutput(entityId)),
  });

  const renameOutput = tool({
    name: "rename_output",
    description:
      "Rename a graph output. Works on outputs inside a subgraph too: the matching output port on the subgraph task is renamed with it, so connections in the parent survive.",
    parameters: z.object({
      entityId: z.string().describe("The $id of the output"),
      newName: z.string().describe("New output name"),
    }),
    execute: async ({ entityId, newName }) =>
      asJson(await bridge.renameOutput(entityId, newName)),
  });

  const updateOutput = tool({
    name: "update_output",
    description:
      "Change an existing graph output's type or description, wherever it lives. Only the fields you pass are changed; pass an empty string to clear the description. Use rename_output for the name. On an output inside a subgraph, the matching port on the subgraph task picks up the new type automatically.",
    parameters: z.object({
      entityId: z.string().describe("The $id of the output"),
      type: z.string().nullable().optional().describe("Type"),
      description: z.string().nullable().optional(),
    }),
    execute: async ({ entityId, type, description }) =>
      asJson(
        await bridge.updateOutput(entityId, {
          type: type ?? undefined,
          description: description ?? undefined,
        }),
      ),
  });

  const connectNodes = tool({
    name: "connect_nodes",
    description:
      "Connect an output port of one entity to an input port of another. Replaces any existing connection to the target port. Both entities must live in the same pipeline or the same subgraph — a connection cannot cross a subgraph boundary. To get a value into or out of a subgraph, wire it to that subgraph task's own ports in the parent.",
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
    description:
      "Delete a binding/edge by its $id, wherever it lives — top-level pipeline or inside a subgraph.",
    parameters: z.object({
      entityId: z.string().describe("The $id of the binding to delete"),
    }),
    execute: async ({ entityId }) => asJson(await bridge.deleteEdge(entityId)),
  });

  const setTaskArgument = tool({
    name: "set_task_argument",
    description:
      "Set a value for a task input, for a task anywhere in the pipeline including inside a subgraph. Removes any existing connection to that port. Accepts a literal string or a graph-input, task-output, or dynamic-data (secret or system) reference object.",
    parameters: z.object({
      taskEntityId: z.string().describe("$id of the task"),
      inputName: z.string().describe("Name of the input port"),
      value: argumentValueSchema.describe(
        "Literal string or a graph-input, task-output, or dynamic-data (secret or system) reference object",
      ),
    }),
    execute: async ({ taskEntityId, inputName, value }) =>
      asJson(
        await bridge.setTaskArgument(
          taskEntityId,
          inputName,
          dropNulls(value) as ArgumentType,
        ),
      ),
  });

  const createSubgraph = tool({
    name: "create_subgraph",
    description:
      "Group 2 or more related tasks into a subgraph. NEVER use for a single task — only group tasks that form a logical unit of work together. Every task passed must already live in the same pipeline or the same subgraph; tasks from different levels cannot be grouped.",
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
      "Inline a subgraph task back into the graph that contains it, expanding its inner tasks. Works on a nested subgraph too — its contents are inlined into the subgraph that held it, not into the top-level pipeline.",
    parameters: z.object({
      taskEntityId: z.string().describe("$id of the subgraph task to unpack"),
    }),
    execute: async ({ taskEntityId }) =>
      asJson(await bridge.unpackSubgraph(taskEntityId)),
  });

  const addStickyNote = tool({
    name: "add_sticky_note",
    description:
      "Add a sticky note — a freeform annotation on the canvas that carries no data and never runs. Use it to record something the user asked to be written down, or a decision worth leaving on the canvas. A note can go anywhere and need not be about any one entity: pass `position` (with `inSubgraphTaskId` for a subgraph) to put it exactly where you want, including empty space where it labels a region or the pipeline as a whole. For the narrower case where the note is about one specific task, input or output, `anchorEntityId` is a shortcut that places it just above that entity in that entity's own graph, so you do not have to work out coordinates. Omit all three to drop it clear of the rest of the graph.",
    parameters: z.object({
      title: z.string().nullable().optional().describe("Short heading"),
      content: z.string().nullable().optional().describe("Note body text"),
      color: z.string().nullable().optional().describe(COLOR_GUIDANCE),
      borderColor: z
        .string()
        .nullable()
        .optional()
        .describe(
          `Only visible when color is "transparent". ${COLOR_GUIDANCE}`,
        ),
      size: sizeSchema
        .nullable()
        .optional()
        .describe(
          `Defaults to ${DEFAULT_FLEX_NODE_SIZE.width}x${DEFAULT_FLEX_NODE_SIZE.height}, which fits a heading and a few words. Size up for anything longer or the text is clipped. ${SIZE_GUIDANCE}`,
        ),
      position: positionSchema
        .nullable()
        .optional()
        .describe(
          "Where to put the note: canvas coordinates, x increasing right and y downwards. Any spot is valid, including empty canvas away from every node. Takes precedence over anchorEntityId.",
        ),
      anchorEntityId: z
        .string()
        .nullable()
        .optional()
        .describe(
          "Shortcut for a note about one specific entity: the $id of a task, input or output, which places the note just above it in that entity's own graph. Prefer `position` when the note is not about a single entity.",
        ),
      inSubgraphTaskId: z
        .string()
        .nullable()
        .optional()
        .describe(
          "$id of a subgraph task to add this inside. Omit for the top-level pipeline, and omit entirely when passing anchorEntityId — the anchor already determines the graph.",
        ),
    }),
    execute: async ({
      title,
      content,
      color,
      borderColor,
      size,
      position,
      anchorEntityId,
      inSubgraphTaskId,
    }) =>
      asJson(
        await bridge.addStickyNote({
          title: title ?? undefined,
          content: content ?? undefined,
          color: color ?? undefined,
          borderColor: borderColor ?? undefined,
          size: size ?? undefined,
          position: position ?? undefined,
          anchorEntityId: anchorEntityId ?? undefined,
          inSubgraphTaskId: inSubgraphTaskId ?? undefined,
        }),
      ),
  });

  const updateStickyNote = tool({
    name: "update_sticky_note",
    description:
      "Change a sticky note's text, colours, size, position or locked state, wherever it lives. Only the fields you pass are changed. A note the user wrote is their content — do not rewrite or recolour one unless they asked. A locked note is refused unless you also pass locked: false.",
    parameters: z.object({
      noteId: z.string().describe("The id of the sticky note to change"),
      title: z.string().nullable().optional(),
      content: z.string().nullable().optional(),
      color: z.string().nullable().optional().describe(COLOR_GUIDANCE),
      borderColor: z.string().nullable().optional().describe(COLOR_GUIDANCE),
      size: sizeSchema.nullable().optional().describe(SIZE_GUIDANCE),
      position: positionSchema.nullable().optional(),
      locked: z
        .boolean()
        .nullable()
        .optional()
        .describe("Locked notes cannot be selected, moved or edited."),
    }),
    execute: async ({
      noteId,
      title,
      content,
      color,
      borderColor,
      size,
      position,
      locked,
    }) =>
      asJson(
        await bridge.updateStickyNote(noteId, {
          title: title ?? undefined,
          content: content ?? undefined,
          color: color ?? undefined,
          borderColor: borderColor ?? undefined,
          size: size ?? undefined,
          position: position ?? undefined,
          locked: locked ?? undefined,
        }),
      ),
  });

  const deleteStickyNote = tool({
    name: "delete_sticky_note",
    description:
      "Delete a sticky note by its id. Notes carry the user's own words, so never delete one they wrote without being asked to.",
    parameters: z.object({
      noteId: z.string().describe("The id of the sticky note to delete"),
    }),
    execute: async ({ noteId }) =>
      asJson(await bridge.deleteStickyNote(noteId)),
  });

  const moveNode = tool({
    name: "move_node",
    description:
      "Move a task, pipeline input, pipeline output or sticky note to canvas coordinates, wherever it lives. Positions are in `get_pipeline_state`, so read them first — x increases to the right and y downwards, and a node with no position has never been placed. Use this for a targeted tidy-up; for rearranging a whole graph, prefer auto_layout.",
    parameters: z.object({
      entityId: z
        .string()
        .describe("$id of the task/input/output, or a sticky note's id"),
      position: positionSchema,
    }),
    execute: async ({ entityId, position }) =>
      asJson(await bridge.moveNode(entityId, position)),
  });

  const autoLayout = tool({
    name: "auto_layout",
    description:
      "Arrange the graph the user is currently looking at, left to right along its connections — the same command as the editor's View > Auto-layout. It applies to the graph on screen only, so it cannot lay out a subgraph the user is not inside. It moves everything on that canvas, sticky notes included: read `stickyNotes` first and say that you moved them.",
    parameters: z.object({
      algorithm: z
        .enum(["sugiyama", "sugiyama_centered", "digco", "dwyer"])
        .nullable()
        .optional()
        .describe(
          "Layout style. Omit for the default (sugiyama), which is what the keyboard shortcut uses.",
        ),
    }),
    execute: async ({ algorithm }) =>
      asJson(await bridge.autoLayout(algorithm ?? undefined)),
  });

  const validatePipeline = tool({
    name: "validate_pipeline",
    description:
      "Validate the whole pipeline — including everything inside every subgraph — for schema errors, missing inputs, orphaned bindings, and cycles. Each issue carries a subgraphPath saying where it is: the chain of subgraph task names from the top level, empty for the top-level pipeline itself. Always call before finalizing.",
    parameters: z.object({}),
    execute: async () => asJson(await bridge.validatePipeline()),
  });

  return {
    getPipelineState,
    getSubgraphState,
    validatePipeline,
    allTools: [
      getPipelineState,
      getSubgraphState,
      setPipelineName,
      setPipelineDescription,
      setPipelineNotes,
      setPipelineTags,
      setRunNameTemplate,
      addTask,
      deleteTask,
      renameTask,
      setTaskColor,
      addInput,
      deleteInput,
      renameInput,
      updateInput,
      addOutput,
      deleteOutput,
      renameOutput,
      updateOutput,
      connectNodes,
      deleteEdge,
      setTaskArgument,
      createSubgraph,
      unpackSubgraph,
      addStickyNote,
      updateStickyNote,
      deleteStickyNote,
      moveNode,
      autoLayout,
      validatePipeline,
    ],
  };
}
