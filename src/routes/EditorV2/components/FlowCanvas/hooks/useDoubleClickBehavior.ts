import type { Node, NodeMouseHandler, ReactFlowProps } from "@xyflow/react";

import type { ComponentSpec } from "@/models/componentSpec";

import { PIPELINE_TREE_WINDOW_ID } from "../../../hooks/usePipelineTreeWindow";
import type { TaskNodeData } from "../../../hooks/useSpecToNodesEdges";
import {
  isTaskSubgraph,
  navigateToSubgraph,
} from "../../../store/navigationStore";
import { restoreWindow } from "../../../windows/windowStore";

export function useDoubleClickBehavior(
  spec: ComponentSpec | null,
): Required<Pick<ReactFlowProps, "onNodeDoubleClick">> {
  const onNodeDoubleClick: NodeMouseHandler = (
    _event: React.MouseEvent,
    node: Node,
  ) => {
    if (!spec) return;
    if (node.type !== "task") return;

    const taskData = node.data as TaskNodeData;
    const taskEntityId = taskData.entityId;

    if (isTaskSubgraph(spec, taskEntityId)) {
      const newSpec = navigateToSubgraph(spec, taskEntityId);
      if (newSpec) {
        restoreWindow(PIPELINE_TREE_WINDOW_ID);
      }
    }
  };

  return { onNodeDoubleClick };
}
