import type { TaskSnapshotData } from "@/routes/v2/shared/nodes/TaskNode/taskManifestBase";
import type { NodeSnapshot } from "@/routes/v2/shared/nodes/types";
import type { ComponentReference } from "@/utils/componentSpec";

import { writeToSystemClipboard } from "./clipboardEnvelope";

/**
 * Build a single-task clipboard envelope from a component reference and write
 * it to the system clipboard. The user can then paste (Cmd+V) inside the V2
 * pipeline editor to drop a new task wired to this component.
 *
 * The task snapshot is intentionally minimal: no arguments, no execution
 * options, no annotations. The paste clone handler assigns a fresh `$id` and
 * positions the node at the paste target, so the entityId/position here are
 * placeholders that get discarded on paste.
 */
export async function copyComponentReferenceToClipboard(
  reference: ComponentReference,
): Promise<void> {
  const name = reference.spec?.name ?? reference.name ?? "task";
  const snapshot: NodeSnapshot<TaskSnapshotData> = {
    $type: "task",
    entityId: "",
    name,
    position: { x: 0, y: 0 },
    data: {
      componentRef: reference,
      isEnabled: undefined,
      arguments: [],
      executionOptions: undefined,
      annotations: [],
    },
  };
  await writeToSystemClipboard([snapshot], []);
}
