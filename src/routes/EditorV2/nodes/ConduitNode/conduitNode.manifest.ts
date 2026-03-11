import type { Edge, Node } from "@xyflow/react";

import type { ComponentSpec } from "@/models/componentSpec";
import type { EdgeConduit } from "@/models/componentSpec/annotations";

import { selectNode } from "../../store/editorStore";
import { buildEntityPositionMap } from "../buildUtils";
import type { NodeTypeManifest } from "../types";
import { ConduitNode, type ConduitNodeData } from "./components/ConduitNode";
import { ConduitDetails } from "./context/ConduitDetails";
import { ConduitEdge, type ConduitEdgeData } from "./edges/ConduitEdge";
import {
  addConduit,
  buildEdgeConduitMap,
  getConduits,
  removeConduit,
  updateConduitPosition,
} from "./hooks/useConduits";

function conduitBundleKey(conduits: EdgeConduit[]): string {
  return conduits.map((conduit) => conduit.id).join(",");
}

function buildBundleCounters(
  edgeConduitMap: Map<string, EdgeConduit[]>,
): Map<string, { total: number; nextIndex: number }> {
  const counters = new Map<string, { total: number; nextIndex: number }>();

  for (const conduits of edgeConduitMap.values()) {
    const key = conduitBundleKey(conduits);
    const entry = counters.get(key);
    if (entry) {
      entry.total += 1;
    } else {
      counters.set(key, { total: 1, nextIndex: 0 });
    }
  }

  return counters;
}

function augmentEdgesWithConduits(
  spec: ComponentSpec,
  edges: Edge[],
  conduits: EdgeConduit[],
): Edge[] {
  const entityPositions = buildEntityPositionMap(
    [...spec.inputs],
    [...spec.outputs],
    [...spec.tasks],
  );

  const edgeConduitMap = buildEdgeConduitMap(conduits, (bindingId) => {
    const binding = [...spec.bindings].find(
      (binding) => binding.$id === bindingId,
    );
    if (!binding) return undefined;
    return entityPositions.get(binding.sourceEntityId);
  });

  const bundleCounters = buildBundleCounters(edgeConduitMap);

  return edges.map((edge) => {
    const bindingId = edge.id.replace(/^edge_/, "");
    const assignedConduits = edgeConduitMap.get(bindingId);

    if (!assignedConduits || assignedConduits.length === 0) return edge;

    const key = conduitBundleKey(assignedConduits);
    const counter = bundleCounters.get(key);
    const bundleIndex = counter ? counter.nextIndex++ : 0;
    const bundleTotal = counter ? counter.total : 1;

    return {
      ...edge,
      type: "conduitEdge",
      data: {
        conduitRects: assignedConduits.map((conduit) => ({
          x: conduit.position.x,
          y: conduit.position.y,
          width: conduit.size.width,
          height: conduit.size.height,
        })),
        bundleIndex,
        bundleTotal,
        conduitColor: assignedConduits[0].color,
      } satisfies ConduitEdgeData,
    };
  });
}

export const conduitManifest: NodeTypeManifest = {
  type: "conduit",
  idPrefix: "conduit_",
  entityType: "conduit",

  component: ConduitNode,
  edgeTypes: { conduitEdge: ConduitEdge },

  buildNodes(spec) {
    return getConduits(spec).map(
      (conduit): Node => ({
        id: conduit.id,
        type: "conduit",
        position: conduit.position,
        width: conduit.size.width,
        height: conduit.size.height,
        data: {
          conduitId: conduit.id,
          color: conduit.color,
          edgeCount: conduit.edgeIds.length,
        } satisfies ConduitNodeData,
        draggable: true,
        selectable: true,
        connectable: false,
      }),
    );
  },

  fingerprintParts(spec) {
    return getConduits(spec).map(
      (conduit) =>
        `c:${conduit.id}:${conduit.position.x},${conduit.position.y}:${conduit.size.width}x${conduit.size.height}:${conduit.color}:${conduit.edgeIds.join(",")}`,
    );
  },

  transformEdges(spec, edges) {
    const conduits = getConduits(spec);
    if (conduits.length === 0) return edges;
    return augmentEdgesWithConduits(spec, edges, conduits);
  },

  drop: {
    dataKey: "conduit",
    handler(spec, _data, position) {
      const conduit = addConduit(spec, position);
      selectNode(conduit.id, "conduit");
    },
  },

  updatePosition(spec, nodeId, position) {
    updateConduitPosition(spec, nodeId, position);
  },

  deleteNode(spec, nodeId) {
    removeConduit(spec, nodeId);
  },

  selectable: false,

  contextPanelComponent: ConduitDetails,
};
