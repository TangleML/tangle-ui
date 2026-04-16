import type { ComponentReference, ComponentSpec } from "@/models/componentSpec";
import {
  connectNodes,
  deleteEdge,
} from "@/routes/v2/pages/Editor/store/actions/connection.actions";
import {
  addInput,
  addOutput,
  deleteInput,
  deleteOutput,
  renameInput,
  renameOutput,
} from "@/routes/v2/pages/Editor/store/actions/io.actions";
import {
  createSubgraph,
  renamePipeline,
  updatePipelineDescription,
} from "@/routes/v2/pages/Editor/store/actions/pipeline.actions";
import {
  addTask,
  deleteTask,
  renameTask,
  unpackSubgraphTask,
} from "@/routes/v2/pages/Editor/store/actions/task.actions";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import type { UndoGroupable } from "@/routes/v2/shared/nodes/types";
import { hydrateComponentReference } from "@/services/componentService";

import type { Command } from "./aiChat.types";

const DEFAULT_POSITION = { x: 250, y: 250 };
const POSITION_OFFSET = 200;

type TempIdMap = Map<string, string>;

function computeNextPosition(spec: ComponentSpec): { x: number; y: number } {
  const allEntities = [...spec.tasks, ...spec.inputs, ...spec.outputs];
  if (allEntities.length === 0) return DEFAULT_POSITION;

  let maxX = 0;
  let maxY = 0;
  for (const entity of allEntities) {
    const pos = entity.annotations.get("editor.position") as
      | { x: number; y: number }
      | undefined;
    if (pos) {
      maxX = Math.max(maxX, pos.x);
      maxY = Math.max(maxY, pos.y);
    }
  }

  return { x: maxX + POSITION_OFFSET, y: maxY };
}

/**
 * Deep-walk a value and replace any string that matches a tempId placeholder
 * with its resolved real `$id`.
 */
function resolveValue(value: unknown, idMap: TempIdMap): unknown {
  if (typeof value === "string") {
    return idMap.get(value) ?? value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => resolveValue(item, idMap));
  }
  if (typeof value === "object" && value !== null) {
    const resolved: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      resolved[key] = resolveValue(val, idMap);
    }
    return resolved;
  }
  return value;
}

function resolveParams(
  params: Record<string, unknown>,
  idMap: TempIdMap,
): Record<string, unknown> {
  if (idMap.size === 0) return params;
  return resolveValue(params, idMap) as Record<string, unknown>;
}

type HydratedRefMap = Map<number, ComponentReference>;

/**
 * Pre-hydrate componentRefs for all addTask commands so the undo group
 * can remain synchronous. Hydration may fetch YAML from a URL.
 */
async function hydrateAddTaskCommands(
  commands: Command[],
): Promise<HydratedRefMap> {
  const hydratedRefs: HydratedRefMap = new Map();

  const entries = commands
    .map((cmd, index) => ({ cmd, index }))
    .filter(({ cmd }) => cmd.op === "addTask");

  const results = await Promise.all(
    entries.map(async ({ cmd, index }) => {
      const ref = cmd.params.componentRef as ComponentReference | undefined;
      if (!ref) return { index, hydrated: null };
      const hydrated = await hydrateComponentReference(ref);
      return { index, hydrated };
    }),
  );

  for (const { index, hydrated } of results) {
    if (hydrated) {
      hydratedRefs.set(index, hydrated);
    }
  }

  return hydratedRefs;
}

function executeCommand(
  undo: UndoGroupable,
  spec: ComponentSpec,
  command: Command,
  commandIndex: number,
  idMap: TempIdMap,
  hydratedRefs: HydratedRefMap,
): void {
  const { op } = command;
  const params = resolveParams(command.params, idMap);

  switch (op) {
    case "setName": {
      renamePipeline(undo, spec, params.name as string);
      break;
    }

    case "setDescription": {
      updatePipelineDescription(undo, spec, params.description as string);
      break;
    }

    case "addTask": {
      const componentRef =
        hydratedRefs.get(commandIndex) ??
        (params.componentRef as ComponentReference);
      const position = computeNextPosition(spec);
      const task = addTask(undo, spec, componentRef, position);
      if (typeof params.tempId === "string") {
        idMap.set(params.tempId, task.$id);
      }
      break;
    }

    case "deleteTask": {
      deleteTask(undo, spec, params.entityId as string);
      break;
    }

    case "renameTask": {
      renameTask(
        undo,
        spec,
        params.entityId as string,
        params.newName as string,
      );
      break;
    }

    case "addInput": {
      const position = computeNextPosition(spec);
      const input = addInput(undo, spec, position, params.name as string);
      if (params.type) input.setType(params.type as string);
      if (params.description)
        input.setDescription(params.description as string);
      if (params.default) input.setDefaultValue(params.default as string);
      if (params.optional !== undefined)
        input.setOptional(params.optional as boolean);
      if (typeof params.tempId === "string") {
        idMap.set(params.tempId, input.$id);
      }
      break;
    }

    case "deleteInput": {
      deleteInput(undo, spec, params.entityId as string);
      break;
    }

    case "renameInput": {
      renameInput(
        undo,
        spec,
        params.entityId as string,
        params.newName as string,
      );
      break;
    }

    case "addOutput": {
      const position = computeNextPosition(spec);
      const output = addOutput(undo, spec, position, params.name as string);
      if (params.type) output.setType(params.type as string);
      if (params.description)
        output.setDescription(params.description as string);
      if (typeof params.tempId === "string") {
        idMap.set(params.tempId, output.$id);
      }
      break;
    }

    case "deleteOutput": {
      deleteOutput(undo, spec, params.entityId as string);
      break;
    }

    case "renameOutput": {
      renameOutput(
        undo,
        spec,
        params.entityId as string,
        params.newName as string,
      );
      break;
    }

    case "connectNodes": {
      const source = params.source as { entityId: string; portName: string };
      const target = params.target as { entityId: string; portName: string };
      connectNodes(undo, spec, {
        sourceNodeId: source.entityId,
        sourceHandleId: `output_${source.portName}`,
        targetNodeId: target.entityId,
        targetHandleId: `input_${target.portName}`,
      });
      break;
    }

    case "deleteEdge": {
      deleteEdge(undo, spec, `edge_${params.entityId as string}`);
      break;
    }

    case "setTaskArgument": {
      spec.setTaskArgument(
        params.taskEntityId as string,
        params.inputName as string,
        params.value as string,
      );
      break;
    }

    case "createSubgraph": {
      const position = computeNextPosition(spec);
      createSubgraph(
        undo,
        spec,
        params.taskEntityIds as string[],
        params.subgraphName as string,
        position,
      );
      break;
    }

    case "unpackSubgraph": {
      unpackSubgraphTask(undo, spec, params.taskEntityId as string);
      break;
    }

    case "createPythonComponent": {
      // Handled server-side; the componentYaml is attached to the command
      // for use in a follow-up addTask. No client action needed.
      break;
    }

    default: {
      console.warn(`Unknown AI command op: "${op}"`);
    }
  }
}

interface CommandSession {
  processCommand: (spec: ComponentSpec, command: Command) => Promise<void>;
}

export function useProcessCommands() {
  const { undo } = useEditorSession();

  function createSession(): CommandSession {
    const idMap: TempIdMap = new Map();

    return {
      async processCommand(spec: ComponentSpec, command: Command) {
        const hydratedRefs = await hydrateAddTaskCommands([command]);

        undo.withGroup("AI assistant changes", () => {
          try {
            executeCommand(undo, spec, command, 0, idMap, hydratedRefs);
          } catch (error) {
            console.error(
              `Failed to execute AI command "${command.op}":`,
              error,
            );
          }
        });
      },
    };
  }

  async function processCommands(spec: ComponentSpec, commands: Command[]) {
    if (commands.length === 0) return;

    const hydratedRefs = await hydrateAddTaskCommands(commands);
    const idMap: TempIdMap = new Map();

    undo.withGroup("AI assistant changes", () => {
      for (const [index, command] of commands.entries()) {
        try {
          executeCommand(undo, spec, command, index, idMap, hydratedRefs);
        } catch (error) {
          console.error(`Failed to execute AI command "${command.op}":`, error);
        }
      }
    });
  }

  return { processCommands, createSession };
}
