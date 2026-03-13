import type { FlexNodeData } from "@/components/shared/ReactFlow/FlowCanvas/FlexNode/types";
import {
  createFlexNode,
  getFlexNodeDisplayName,
} from "@/components/shared/ReactFlow/FlowCanvas/FlexNode/utils";
import type { ComponentSpec } from "@/models/componentSpec/entities/componentSpec";

import type { FlexNodeSnapshot } from "../../store/nodeCloneHandlers";
import type { NodeTypeManifest } from "../types";
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

const deepClone = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));

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

  fingerprintParts(spec) {
    const nodes = getFlexNodes(spec);
    return nodes.map((n) => `flex:${JSON.stringify(n)}`);
  },

  drop: {
    dataKey: "flex",
    handler(spec, _data, position) {
      addFlexNode(spec, position);
    },
  },

  getPosition(spec, nodeId) {
    const flexNode = findFlexNode(spec, nodeId);
    if (!flexNode) return undefined;
    return flexNode.position;
  },

  updatePosition(spec, nodeId, position) {
    updateFlexNodePosition(spec, nodeId, position);
  },

  deleteNode(spec, nodeId) {
    removeFlexNode(spec, nodeId);
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
    snapshot(spec, entityId) {
      const node = findFlexNode(spec, entityId);
      if (!node) return null;

      return {
        entityId: node.id,
        type: "flex",
        name: getFlexNodeDisplayName(node),
        position: node.position,
        data: {
          properties: deepClone(node.properties),
          metadata: deepClone(node.metadata),
          size: deepClone(node.size),
          zIndex: node.zIndex,
          locked: node.locked,
        },
      } satisfies FlexNodeSnapshot;
    },

    clone(spec, snapshot, _idGen, position) {
      if (snapshot.type !== "flex") return null;
      const { data } = snapshot as FlexNodeSnapshot;
      const id = `flex_${crypto.randomUUID()}`;

      const newNode: FlexNodeData = {
        id,
        properties: deepClone(data.properties) as FlexNodeData["properties"],
        metadata: deepClone(data.metadata) as FlexNodeData["metadata"],
        size: deepClone(data.size),
        position,
        zIndex: data.zIndex,
        locked: data.locked,
      };

      const nodes = getFlexNodes(spec);
      setFlexNodes(spec, [...nodes, newNode]);
      return id;
    },
  },
};
