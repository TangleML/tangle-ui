import type { Node, NodeProps } from "@xyflow/react";

import { createFlexNode } from "@/components/shared/ReactFlow/FlowCanvas/FlexNode/utils";
import { getFlexNodes } from "@/models/componentSpec/queries/flexNodes";
import {
  augmentEdgesWithGuidelines,
  buildConduitNode,
  getConduitPosition,
  getConduits,
} from "@/routes/v2/shared/nodes/ConduitNode/conduit.utils";
import { ConduitNode } from "@/routes/v2/shared/nodes/ConduitNode/ConduitNode";
import { ConduitEdge } from "@/routes/v2/shared/nodes/ConduitNode/edges/ConduitEdge";
import { inputManifestBase } from "@/routes/v2/shared/nodes/IONode/inputManifestBase";
import { outputManifestBase } from "@/routes/v2/shared/nodes/IONode/outputManifestBase";
import { NodeTypeRegistry } from "@/routes/v2/shared/nodes/registry";
import { taskManifestBase } from "@/routes/v2/shared/nodes/TaskNode/taskManifestBase";
import { TaskNode } from "@/routes/v2/shared/nodes/TaskNode/TaskNode";
import type { TaskNodeData } from "@/routes/v2/shared/nodes/types";

import { RemoteFlexNode } from "./components/RemoteFlexNode";

function RemoteTaskNode(props: NodeProps<Node<TaskNodeData, "task">>) {
  return <TaskNode {...props} readOnly />;
}

const noMutation = {
  updatePosition() {},
  deleteNode() {},
};

export const remotePipelineViewRegistry = new NodeTypeRegistry();
remotePipelineViewRegistry.register({
  ...taskManifestBase,
  ...noMutation,
  component: RemoteTaskNode,
});
remotePipelineViewRegistry.register({ ...inputManifestBase, ...noMutation });
remotePipelineViewRegistry.register({ ...outputManifestBase, ...noMutation });
remotePipelineViewRegistry.register({
  type: "flex",
  idPrefix: "flex_",
  entityType: "flex",
  component: RemoteFlexNode,
  buildNodes: (spec) =>
    getFlexNodes(spec).map((note) => ({
      ...createFlexNode(note, true),
      draggable: false,
      selectable: false,
    })),
  getPosition: (spec, nodeId) =>
    getFlexNodes(spec).find((note) => note.id === nodeId)?.position,
  ...noMutation,
  selectable: false,
});
remotePipelineViewRegistry.register({
  type: "conduit",
  idPrefix: "conduit_",
  entityType: "conduit",
  component: ConduitNode,
  edgeTypes: { conduitEdge: ConduitEdge },
  buildNodes: (spec) =>
    getConduits(spec).map((conduit) => buildConduitNode(conduit, false)),
  transformEdges: (spec, edges) =>
    augmentEdgesWithGuidelines(spec, edges, getConduits(spec)),
  getPosition(spec, nodeId) {
    const conduit = getConduits(spec).find((item) => item.id === nodeId);
    return conduit ? getConduitPosition(conduit) : undefined;
  },
  ...noMutation,
  selectable: false,
});
