import type { Node, NodeProps } from "@xyflow/react";

import { createFlexNode } from "@/components/shared/ReactFlow/FlowCanvas/FlexNode/utils";
import {
  findFlexNode,
  getFlexNodes,
} from "@/models/componentSpec/queries/flexNodes";
import { InputDetails } from "@/routes/v2/pages/Editor/nodes/IONode/context/InputDetails";
import { OutputDetails } from "@/routes/v2/pages/Editor/nodes/IONode/context/OutputDetails";
import { TaskDetails } from "@/routes/v2/pages/Editor/nodes/TaskNode/context/TaskDetails/TaskDetails";
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
  contextPanelComponent: ({ entityId }) => (
    <TaskDetails entityId={entityId} readOnly />
  ),
});
remotePipelineViewRegistry.register({
  ...inputManifestBase,
  ...noMutation,
  contextPanelComponent: ({ entityId }) => (
    <InputDetails entityId={entityId} readOnly />
  ),
});
remotePipelineViewRegistry.register({
  ...outputManifestBase,
  ...noMutation,
  contextPanelComponent: ({ entityId }) => (
    <OutputDetails entityId={entityId} readOnly />
  ),
});
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
