import type { Node, NodeProps } from "@xyflow/react";

import { createFlexNode } from "@/components/shared/ReactFlow/FlowCanvas/FlexNode/utils";
import {
  findFlexNode,
  getFlexNodes,
} from "@/models/componentSpec/queries/flexNodes";
import { readOnlyConduitManifest } from "@/routes/v2/shared/nodes/ConduitNode/readOnlyConduit.manifest";
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
  getPosition: (spec, nodeId) => findFlexNode(spec, nodeId)?.position,
  ...noMutation,
  selectable: false,
});
remotePipelineViewRegistry.register(readOnlyConduitManifest);
