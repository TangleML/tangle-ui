import {
  createEntityNode,
  ioDefaultPosition,
} from "@/routes/v2/shared/nodes/buildUtils";
import type { ManifestPartial } from "@/routes/v2/shared/nodes/manifestBases";
import type { IONodeData } from "@/routes/v2/shared/nodes/types";

import { IONode } from "./IONode";

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

  fingerprintParts(spec) {
    return [...spec.outputs].map((output) => {
      const pos = output.annotations.get("editor.position");
      const z = output.annotations.get("zIndex");
      return `o:${output.$id}:${output.name}:${pos.x},${pos.y}:z${z ?? ""}`;
    });
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
};
