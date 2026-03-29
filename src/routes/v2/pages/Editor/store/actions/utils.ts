import type { ComponentSpec } from "@/models/componentSpec";
import { IncrementingIdGenerator } from "@/models/componentSpec";
import { editorRegistry } from "@/routes/v2/pages/Editor/nodes";
import type { NodeEntityType } from "@/routes/v2/shared/store/editorStore";

export const TASK_COLOR_ANNOTATION = "tangleml.com/editor/task-color";
export const idGen = new IncrementingIdGenerator();

export function getNodeTypeFromId(
  spec: ComponentSpec | null,
  nodeId: string,
): NodeEntityType | null {
  return (
    (editorRegistry.getByNodeId(spec, nodeId)
      ?.entityType as NodeEntityType) /** todo: adjust typing to avoid casting */ ??
    null
  );
}
