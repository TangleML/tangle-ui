import type { ComponentSpec } from "@/models/componentSpec";
import type { Output } from "@/models/componentSpec/entities/output";
import type { Annotation } from "@/models/componentSpec/entities/types";
import {
  createEntityNode,
  ioDefaultPosition,
} from "@/routes/v2/shared/nodes/buildUtils";
import type { ManifestPartial } from "@/routes/v2/shared/nodes/manifestBases";
import type { IONodeData, NodeSnapshot } from "@/routes/v2/shared/nodes/types";
import { deepClone } from "@/utils/deepClone";

import { IONode } from "./IONode";

// ---------------------------------------------------------------------------
// Output snapshot (shared between Editor and RunView for copy)
// ---------------------------------------------------------------------------

type OutputSnapshotData = Pick<Output, "type" | "description"> & {
  annotations: Annotation[];
};

export function snapshotOutput(
  spec: ComponentSpec,
  entityId: string,
): NodeSnapshot<OutputSnapshotData> | null {
  const output = spec.outputs.find((o) => o.$id === entityId);
  if (!output) return null;

  const nonEditorAnnotations = output.annotations.items
    .filter((a) => !a.key.startsWith("editor."))
    .map((a) => deepClone(a));

  return {
    $type: "output",
    entityId: output.$id,
    name: output.name,
    position: output.annotations.get("editor.position"),
    data: {
      type: output.type ? deepClone(output.type) : undefined,
      description: output.description,
      annotations: nonEditorAnnotations,
    },
  };
}

export function isOutputSnapshot(
  snapshot: NodeSnapshot,
): snapshot is NodeSnapshot<OutputSnapshotData> {
  return snapshot.$type === "output";
}

export const outputManifestBase: ManifestPartial = {
  type: "io",
  idPrefix: "output_",
  entityType: "output",

  component: IONode,

  buildNodes(spec) {
    return [...spec.outputs].map((output, index) =>
      createEntityNode(output, "io", ioDefaultPosition(index, 800), {
        entityId: output.$id,
        ioType: "output",
        name: output.name,
      } satisfies IONodeData),
    );
  },

  getPosition(spec, nodeId) {
    const output = spec.outputs.find((o) => o.$id === nodeId);
    if (!output) return undefined;
    return output.annotations.get("editor.position");
  },

  findEntity(spec, entityId) {
    return spec.outputs.find((o) => o.$id === entityId);
  },

  selectable: true,

  toSelectedNode(node) {
    return { id: node.id, type: "output", position: node.position };
  },

  displayName(spec, entityId) {
    const output = spec.outputs.find((o) => o.$id === entityId);
    return output?.name ?? entityId;
  },

  icon: "Upload",
  iconColor: "text-green-500",

  snapshotHandler: { snapshot: snapshotOutput },
};
