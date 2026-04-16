import type { FlexNodeData } from "@/components/shared/ReactFlow/FlowCanvas/FlexNode/types";
import {
  createFlexNode,
  getFlexNodeDisplayName,
} from "@/components/shared/ReactFlow/FlowCanvas/FlexNode/utils";
import type { ComponentSpec } from "@/models/componentSpec/entities/componentSpec";
import type {
  NodeSnapshot,
  NodeTypeManifest,
} from "@/routes/v2/shared/nodes/types";
import { deepClone } from "@/utils/deepClone";

import { EditorV2FlexNode } from "./components/FlexNode";
import { FlexNodeDetails } from "./context/FlexNodeDetails";
import {
  addFlexNode,
  findFlexNode,
  getFlexNodes,
  removeFlexNode,
  setFlexNodes,
  updateFlexNodePosition,
} from "./flexNode.actions";

interface FlexSnapshotData {
  properties: Record<string, unknown>;
  metadata: Record<string, unknown>;
  size: { width: number; height: number };
  zIndex: number;
  locked?: boolean;
}

function isFlexSnapshot(
  snapshot: NodeSnapshot,
): snapshot is NodeSnapshot<FlexSnapshotData> {
  return snapshot.$type === "flex";
}

export const flexNodeManifest: NodeTypeManifest = {
  type: "flex",
  idPrefix: "flex_",
  entityType: "flex",

  hasEntityId(spec: ComponentSpec, id: string) {
    return findFlexNode(spec, id) !== undefined;
  },

  component: EditorV2FlexNode,

  buildNodes(spec) {
    return getFlexNodes(spec).map((flexNode) => createFlexNode(flexNode));
  },

  drop: {
    dataKey: "flex",
    handler(spec, _data, position, undo) {
      addFlexNode(undo, spec, position);
    },
  },

  getPosition(spec, nodeId) {
    const flexNode = findFlexNode(spec, nodeId);
    if (!flexNode) return undefined;
    return flexNode.position;
  },

  updatePosition(undo, spec, nodeId, position) {
    updateFlexNodePosition(undo, spec, nodeId, position);
  },

  deleteNode(undo, spec, nodeId) {
    removeFlexNode(undo, spec, nodeId);
  },

  findEntity(spec, entityId) {
    return findFlexNode(spec, entityId);
  },

  selectable: true,

  toSelectedNode(node) {
    return { id: node.id, type: "flex", position: node.position };
  },

  contextPanelComponent: FlexNodeDetails,

  displayName(spec, entityId) {
    const node = findFlexNode(spec, entityId);
    if (!node) return entityId;
    return getFlexNodeDisplayName(node);
  },

  icon: "StickyNote",
  iconColor: "text-yellow-500",

  cloneHandler: {
    snapshot(spec, entityId): NodeSnapshot<FlexSnapshotData> | null {
      const node = findFlexNode(spec, entityId);
      if (!node) return null;

      return {
        $type: "flex",
        entityId: node.id,
        name: getFlexNodeDisplayName(node),
        position: node.position,
        data: {
          properties: deepClone(node.properties),
          metadata: deepClone(node.metadata),
          size: deepClone(node.size),
          zIndex: node.zIndex,
          locked: node.locked,
        },
      };
    },

    clone(spec, snapshot, _idGen, position, undo) {
      if (!isFlexSnapshot(snapshot)) return null;

      const id = `flex_${crypto.randomUUID()}`;
      const newNode: FlexNodeData = {
        id,
        properties: deepClone(
          snapshot.data.properties,
        ) as FlexNodeData["properties"],
        metadata: deepClone(snapshot.data.metadata) as FlexNodeData["metadata"],
        size: deepClone(snapshot.data.size),
        position,
        zIndex: snapshot.data.zIndex,
        locked: snapshot.data.locked,
      };

      const nodes = getFlexNodes(spec);
      setFlexNodes(undo, spec, [...nodes, newNode]);
      return id;
    },
  },
};
