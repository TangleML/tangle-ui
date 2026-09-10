import type { ComponentSpec } from "@/models/componentSpec";

export type ChatEntityKind = "task" | "input" | "output";

export interface ResolvedChatEntity {
  /** The entity's live `$id` in the given spec (may differ from the requested id). */
  entityId: string;
  kind: ChatEntityKind;
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

/**
 * Resolves an `entity://` chip to a concrete entity in a spec. Prefers a `$id`
 * match, then falls back to matching the chip label against entity names — IDs
 * are regenerated on deserialize, so a chip written in a prior session can
 * carry a stale id while the name is stable.
 */
export function resolveChatEntity(
  spec: ComponentSpec | null | undefined,
  entityId: string,
  label: string,
): ResolvedChatEntity | undefined {
  if (!spec) return undefined;

  const groups = entityGroups(spec);

  for (const { kind, items } of groups) {
    const byId = items.find((item) => item.$id === entityId);
    if (byId) return { entityId: byId.$id, kind };
  }

  for (const { kind, items } of groups) {
    const byName = items.find((item) => item.name === label);
    if (byName) return { entityId: byName.$id, kind };
  }

  return undefined;
}

/**
 * Best-effort entity kind from an `entity://` id prefix, for rendering a chip
 * icon before (or without) a loaded spec. IDs look like `task_…`, `input_…`,
 * `output_…`; agent-authored placeholders may use a dash (`task-…`).
 */
export function chatEntityKindFromId(
  entityId: string,
): ChatEntityKind | "unknown" {
  if (entityId.startsWith("task")) return "task";
  if (entityId.startsWith("input")) return "input";
  if (entityId.startsWith("output")) return "output";
  return "unknown";
}
