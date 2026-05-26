import type { ComponentSpec } from "@/models/componentSpec";
import type { Input } from "@/models/componentSpec/entities/input";
import type { Annotation } from "@/models/componentSpec/entities/types";
import {
  createEntityNode,
  ioDefaultPosition,
} from "@/routes/v2/shared/nodes/buildUtils";
import type { ManifestPartial } from "@/routes/v2/shared/nodes/manifestBases";
import type { IONodeData, NodeSnapshot } from "@/routes/v2/shared/nodes/types";
import { EDITOR_POSITION_ANNOTATION } from "@/utils/annotations";
import { deepClone } from "@/utils/deepClone";

import { IONode } from "./IONode";

// ---------------------------------------------------------------------------
// Input snapshot (shared between Editor and RunView for copy)
// ---------------------------------------------------------------------------

type InputSnapshotData = Pick<
  Input,
  "type" | "description" | "defaultValue" | "optional"
> & {
  annotations: Annotation[];
};

export function snapshotInput(
  spec: ComponentSpec,
  entityId: string,
): NodeSnapshot<InputSnapshotData> | null {
  const input = spec.inputs.find((i) => i.$id === entityId);
  if (!input) return null;

  const nonEditorAnnotations = input.annotations.items
    .filter((a) => !a.key.startsWith("editor."))
    .map((a) => deepClone(a));

  return {
    $type: "input",
    entityId: input.$id,
    name: input.name,
    position: input.annotations.get(EDITOR_POSITION_ANNOTATION),
    data: {
      type: input.type ? deepClone(input.type) : undefined,
      description: input.description,
      defaultValue: input.defaultValue,
      optional: input.optional,
      annotations: nonEditorAnnotations,
    },
  };
}

export function isInputSnapshot(
  snapshot: NodeSnapshot,
): snapshot is NodeSnapshot<InputSnapshotData> {
  return snapshot.$type === "input";
}

export const inputManifestBase: ManifestPartial = {
  type: "input",
  idPrefix: "input_",
  entityType: "input",

  component: IONode,

  buildNodes(spec) {
    return [...spec.inputs].map((input, index) =>
      createEntityNode(
        input,
        "input",
        ioDefaultPosition(index, -200),
        {
          entityId: input.$id,
          ioType: "input",
          name: input.name,
        } satisfies IONodeData,
        { "data-task-name": input.name, "data-tour-node": "input" },
      ),
    );
  },

  getPosition(spec, nodeId) {
    const input = spec.inputs.find((i) => i.$id === nodeId);
    if (!input) return undefined;
    return input.annotations.get(EDITOR_POSITION_ANNOTATION);
  },

  findEntity(spec, entityId) {
    return spec.inputs.find((i) => i.$id === entityId);
  },

  selectable: true,

  toSelectedNode(node) {
    return { id: node.id, type: "input", position: node.position };
  },

  displayName(spec, entityId) {
    const input = spec.inputs.find((i) => i.$id === entityId);
    return input?.name ?? entityId;
  },

  icon: "Download",
  iconColor: "text-blue-500",

  snapshotHandler: { snapshot: snapshotInput },
};
