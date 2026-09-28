import type { ComponentSpec } from "@/models/componentSpec";
import { locateEntity } from "@/models/componentSpec/queries/locateEntity";

export type ChatEntityKind = "task" | "input" | "output";

export interface ResolvedChatEntity {
  entityId: string;
  kind: ChatEntityKind;
  subgraphTaskNames: string[];
}

interface EntityGroup {
  kind: ChatEntityKind;
  items: readonly { $id: string; name: string }[];
}

function entityGroups(spec: ComponentSpec): EntityGroup[] {
  return [
    { kind: "task", items: spec.tasks },
    { kind: "input", items: spec.inputs },
    { kind: "output", items: spec.outputs },
  ];
}

function locateByName(
  spec: ComponentSpec,
  label: string,
): ResolvedChatEntity | undefined {
  for (const { kind, items } of entityGroups(spec)) {
    const match = items.find((item) => item.name === label);
    if (match) return { entityId: match.$id, kind, subgraphTaskNames: [] };
  }

  for (const task of spec.tasks) {
    if (!task.subgraphSpec) continue;
    const nested = locateByName(task.subgraphSpec, label);
    if (nested) {
      return {
        ...nested,
        subgraphTaskNames: [task.name, ...nested.subgraphTaskNames],
      };
    }
  }

  return undefined;
}

/**
 * Resolves an `entity://` chip to a concrete entity anywhere in the spec tree.
 * Prefers a `$id` match (via `locateEntity`, which recurses subgraphs), then
 * falls back to matching the chip label against entity names — IDs are
 * regenerated on deserialize, so a chip written in a prior session can carry a
 * stale id while the name is stable. `subgraphTaskNames` is the chain of
 * subgraph task names owning the entity, empty when it lives in the root spec.
 */
export function resolveChatEntity(
  spec: ComponentSpec | null | undefined,
  entityId: string,
  label: string,
): ResolvedChatEntity | undefined {
  if (!spec) return undefined;

  const byId = locateEntity(spec, entityId);
  if (byId && byId.kind !== "binding") {
    return {
      entityId: byId.entity.$id,
      kind: byId.kind,
      subgraphTaskNames: byId.subgraphTaskNames,
    };
  }

  return locateByName(spec, label);
}

/**
 * Best-effort entity kind from an `entity://` id prefix, for rendering a chip
 * icon before (or without) a loaded spec. IDs look like `task_…`, `input_…`,
 * `output_…`; agent-authored placeholders may use a dash (`task-…`).
 */
export function chatEntityKindFromId(
  entityId: string,
): ChatEntityKind | "unknown" {
  if (/^task[_-]/.test(entityId)) return "task";
  if (/^input[_-]/.test(entityId)) return "input";
  if (/^output[_-]/.test(entityId)) return "output";
  return "unknown";
}
