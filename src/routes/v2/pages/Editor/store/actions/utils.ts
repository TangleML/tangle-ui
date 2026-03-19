import "@/routes/v2/pages/Editor/nodes"; // ensure manifests are registered

import type { ComponentSpec } from "@/models/componentSpec";
import { IncrementingIdGenerator } from "@/models/componentSpec";
import { NODE_TYPE_REGISTRY } from "@/routes/v2/shared/nodes/registry";
import type { NodeEntityType } from "@/routes/v2/shared/store/editorStore";

export const TASK_COLOR_ANNOTATION = "tangleml.com/editor/task-color";
export const idGen = new IncrementingIdGenerator();

export function getNodeTypeFromId(
  spec: ComponentSpec | null,
  nodeId: string,
): NodeEntityType | null {
  return (
    (NODE_TYPE_REGISTRY.getByNodeId(spec, nodeId)
      ?.entityType as NodeEntityType) /** todo: adjust typing to avoid casting */ ??
    null
  );
}
