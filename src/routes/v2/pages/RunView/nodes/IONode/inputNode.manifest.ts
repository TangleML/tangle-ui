import { IONode } from "@/routes/v2/pages/Editor/nodes/IONode/components/IONode";
import {
  createEntityNode,
  ioDefaultPosition,
} from "@/routes/v2/shared/nodes/buildUtils";
import type {
  IONodeData,
  NodeTypeManifest,
} from "@/routes/v2/shared/nodes/types";

export const inputManifest: NodeTypeManifest = {
  type: "io",
  idPrefix: "input_",
  entityType: "input",

  component: IONode,

  buildNodes(spec) {
    return [...spec.inputs].map((input, index) =>
      createEntityNode(input, "io", ioDefaultPosition(index, -200), {
        entityId: input.$id,
        ioType: "input",
        name: input.name,
      } satisfies IONodeData),
    );
  },

  fingerprintParts(spec) {
    return [...spec.inputs].map((input) => {
      const pos = input.annotations.get("editor.position");
      const z = input.annotations.get("zIndex");
      return `i:${input.$id}:${input.name}:${pos.x},${pos.y}:z${z ?? ""}`;
    });
  },

  getPosition(spec, nodeId) {
    const input = spec.inputs.find((i) => i.$id === nodeId);
    if (!input) return undefined;
    return input.annotations.get("editor.position");
  },

  updatePosition() {},
  deleteNode() {},

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
};
