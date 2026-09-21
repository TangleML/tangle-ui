/**
 * Resolves which spec in the tree a CSOM mutation should be applied to.
 *
 * The agent addresses entities by `$id` alone, with no indication of depth, so
 * every mutating handler resolves the owning spec here rather than assuming the
 * root. Failures come back as prose naming the entity and its subgraph: without
 * that the model gets the same bare `{ success: false }` for "no such entity" as
 * for "that entity is a task, not an input", and cannot tell the user which.
 */
import { isPickableColor, PRESET_COLORS } from "@/components/ui/colorPresets";
import type { ArgumentType, ComponentSpec } from "@/models/componentSpec";
import type { FlexNodeLocation } from "@/models/componentSpec/queries/flexNodes";
import { locateFlexNode } from "@/models/componentSpec/queries/flexNodes";
import type {
  EntityLocation,
  EntityLocationOf,
  LocatedEntityKind,
} from "@/models/componentSpec/queries/locateEntity";
import {
  isLocationOfKind,
  locatedEntityName,
  locateEntity,
} from "@/models/componentSpec/queries/locateEntity";
import {
  isGraphInputArgument,
  isTaskOutputArgument,
} from "@/utils/componentSpec";

const EXPECTED_LABEL: Record<LocatedEntityKind, string> = {
  task: "a task",
  input: "an input",
  output: "an output",
  binding: "a binding",
};

export interface MutationResult {
  success: boolean;
  error?: string;
}

type TargetResolution<K extends LocatedEntityKind> =
  { ok: true; location: EntityLocationOf<K> } | { ok: false; error: string };

function describeEntity(location: EntityLocation, entityId: string): string {
  const name = locatedEntityName(location);
  const label = name ? `"${name}"` : `$id "${entityId}"`;
  return `${location.kind} ${label}`;
}

export function describeEntityLocation(
  location: EntityLocation,
  entityId: string,
): string {
  const entity = describeEntity(location, entityId);
  if (location.subgraphTaskNames.length === 0) {
    return `${entity} in the top-level pipeline`;
  }
  return `${entity} inside subgraph "${location.subgraphTaskNames.join(" > ")}"`;
}

export function resolveTarget<K extends LocatedEntityKind>(
  root: ComponentSpec,
  entityId: string,
  expected: K,
): TargetResolution<K> {
  const location = locateEntity(root, entityId);

  if (!location) {
    return {
      ok: false,
      error: `No ${expected} with $id "${entityId}" exists in this pipeline.`,
    };
  }

  if (!isLocationOfKind(location, expected)) {
    return {
      ok: false,
      error: `$id "${entityId}" refers to ${describeEntity(location, entityId)}, not ${EXPECTED_LABEL[expected]}.`,
    };
  }

  return { ok: true, location };
}

/**
 * Connection endpoints can be tasks, graph inputs or graph outputs, so they are
 * resolved by exclusion rather than against a single expected kind.
 */
export function resolveConnectable(
  root: ComponentSpec,
  entityId: string,
): { ok: true; location: EntityLocation } | { ok: false; error: string } {
  const location = locateEntity(root, entityId);

  if (!location) {
    return {
      ok: false,
      error: `No entity with $id "${entityId}" exists in this pipeline.`,
    };
  }

  if (location.kind === "binding") {
    return {
      ok: false,
      error: `$id "${entityId}" refers to an existing connection, not a task or port that can be connected.`,
    };
  }

  return { ok: true, location };
}

/**
 * Resolves where a newly created entity belongs. `undefined` means the
 * top-level pipeline; otherwise the `$id` must name a subgraph task, whose
 * inner spec becomes the destination.
 */
export function resolveDestination(
  root: ComponentSpec,
  subgraphTaskId: string | undefined,
): { ok: true; spec: ComponentSpec } | { ok: false; error: string } {
  if (!subgraphTaskId) {
    return { ok: true, spec: root };
  }

  const target = resolveTarget(root, subgraphTaskId, "task");
  if (!target.ok) return target;

  const { location } = target;
  const subgraphSpec = location.entity.subgraphSpec;
  if (!subgraphSpec) {
    return {
      ok: false,
      error: `Task "${location.entity.name}" is not a subgraph, so nothing can be added inside it. Omit inSubgraphTaskId to add to the top-level pipeline instead.`,
    };
  }

  return { ok: true, spec: subgraphSpec };
}

/**
 * `explainRefusal` names the causes that are knowable before the mutation runs
 * — a rename that would collide, an unpack of something that is not a subgraph.
 * The generic message below is the branch we genuinely cannot explain, so it
 * should stay rare rather than being the default answer.
 */
export function applyToTarget<K extends LocatedEntityKind>(
  root: ComponentSpec,
  entityId: string,
  expected: K,
  apply: (location: EntityLocationOf<K>) => boolean,
  explainRefusal?: (location: EntityLocationOf<K>) => string | undefined,
): MutationResult {
  const target = resolveTarget(root, entityId, expected);
  if (!target.ok) {
    return { success: false, error: target.error };
  }

  const { location } = target;
  const refusal = explainRefusal?.(location);
  if (refusal) {
    return { success: false, error: refusal };
  }

  if (!apply(location)) {
    return {
      success: false,
      error: `The requested change to ${describeEntityLocation(location, entityId)} could not be applied.`,
    };
  }

  return { success: true };
}

/**
 * Renames fail for exactly one reason once the entity has been resolved by
 * `$id`: another entity of the same kind in that graph already holds the name.
 */
export function explainNameCollision(
  siblings: readonly { $id: string; name: string }[],
  entityId: string,
  newName: string,
  location: EntityLocation,
): string | undefined {
  const taken = siblings.some((s) => s.name === newName && s.$id !== entityId);
  if (!taken) return undefined;

  return `Cannot rename ${describeEntityLocation(location, entityId)} to "${newName}" — that name is already taken in that graph. Pick a different name.`;
}

/**
 * The existence check is not optional: `updateFlexNode` and `removeFlexNode`
 * both map or filter over the list, so an unknown id is a silent no-op that the
 * model would otherwise read back as success.
 */
export function resolveStickyNote(
  root: ComponentSpec,
  noteId: string,
): { ok: true; location: FlexNodeLocation } | { ok: false; error: string } {
  const location = locateFlexNode(root, noteId);
  if (!location) {
    return {
      ok: false,
      error: `No sticky note with id "${noteId}" exists in this pipeline.`,
    };
  }
  return { ok: true, location };
}

/**
 * Anything with a place on the canvas, which cuts across the entity model and
 * the sticky-note list: tasks, ports and notes all move the same way, so
 * `move_node` resolves them together rather than as three tools.
 */
export function resolveMovable(
  root: ComponentSpec,
  nodeId: string,
):
  | { ok: true; spec: ComponentSpec; description: string }
  | { ok: false; error: string } {
  const entity = locateEntity(root, nodeId);
  if (entity) {
    if (entity.kind === "binding") {
      return {
        ok: false,
        error: `$id "${nodeId}" refers to a connection, which has no position of its own — it follows the nodes it joins.`,
      };
    }
    return {
      ok: true,
      spec: entity.spec,
      description: describeEntityLocation(entity, nodeId),
    };
  }

  const note = locateFlexNode(root, nodeId);
  if (note) {
    if (note.node.locked) {
      return {
        ok: false,
        error: `${describeStickyNoteLocation(note)} is locked, so it cannot be moved. Ask the user to unlock it first.`,
      };
    }
    return {
      ok: true,
      spec: note.spec,
      description: describeStickyNoteLocation(note),
    };
  }

  return {
    ok: false,
    error: `No task, input, output or sticky note with id "${nodeId}" exists in this pipeline.`,
  };
}

export function describeStickyNoteLocation(location: FlexNodeLocation): string {
  const { title } = location.node.properties;
  const note = title
    ? `sticky note "${title}"`
    : `sticky note ${location.node.id}`;
  if (location.subgraphTaskNames.length === 0) {
    return `${note} in the top-level pipeline`;
  }
  return `${note} inside subgraph "${location.subgraphTaskNames.join(" > ")}"`;
}

/** An unpickable colour is one the canvas renders as nothing, silently. */
export function explainUnpickableColor(
  color: string,
  field: string,
): string | undefined {
  if (isPickableColor(color)) return undefined;

  return `"${color}" is not a colour this editor accepts for ${field}. Use a hex value like "#FFF9C4", or "transparent". The swatches offered in the UI are: ${PRESET_COLORS.join(", ")}.`;
}

export function explainNotASubgraph(
  location: EntityLocationOf<"task">,
  entityId: string,
): string | undefined {
  if (location.entity.subgraphSpec) return undefined;

  return `${describeEntityLocation(location, entityId)} is not a subgraph, so there is nothing to unpack.`;
}

/**
 * An argument that references a graph input or another task's output only
 * serializes if the referent lives in the same graph as the task being written
 * to — the pipeline format has no way to express a reference across a subgraph
 * boundary, so writing one produces YAML that fails to load.
 *
 * `taskOutput.taskId` is a task **name** in the stored format, but every prompt
 * tells the model to address entities by `$id`, so both are accepted here and
 * normalized to the name.
 */
export function resolveArgumentValue(
  location: EntityLocationOf<"task">,
  value: ArgumentType,
): { ok: true; value: ArgumentType } | { ok: false; error: string } {
  const { spec } = location;

  if (isGraphInputArgument(value)) {
    const { inputName } = value.graphInput;
    if (!spec.inputs.some((i) => i.name === inputName)) {
      return {
        ok: false,
        error: `${describeGraph(location)} has no input named "${inputName}", so ${location.entity.name} cannot read from it. A value cannot be referenced across a subgraph boundary — add an input to that graph and wire it through instead.`,
      };
    }
    return { ok: true, value };
  }

  if (isTaskOutputArgument(value)) {
    const { taskId, outputName } = value.taskOutput;
    const source = spec.tasks.find(
      (t) => t.$id === taskId || t.name === taskId,
    );
    if (!source) {
      return {
        ok: false,
        error: `${describeGraph(location)} has no task "${taskId}", so ${location.entity.name} cannot read its output. A value cannot be referenced across a subgraph boundary — route it through that subgraph's own inputs and outputs instead.`,
      };
    }
    const hasOutput = source.resolvedComponentSpec?.outputs?.some(
      (o) => o.name === outputName,
    );
    if (!hasOutput) {
      return {
        ok: false,
        error: `Task "${source.name}" has no output named "${outputName}".`,
      };
    }
    return {
      ok: true,
      value: { taskOutput: { ...value.taskOutput, taskId: source.name } },
    };
  }

  return { ok: true, value };
}

function describeGraph(location: EntityLocation): string {
  if (location.subgraphTaskNames.length === 0) {
    return "The top-level pipeline";
  }
  return `Subgraph "${location.subgraphTaskNames.join(" > ")}"`;
}
