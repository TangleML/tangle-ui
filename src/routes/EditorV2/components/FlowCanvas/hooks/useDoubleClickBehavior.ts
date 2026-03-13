import "../../../nodes"; // ensure manifests are registered

import type { Node, NodeMouseHandler, ReactFlowProps } from "@xyflow/react";

import type { ComponentSpec } from "@/models/componentSpec";

import { NODE_TYPE_REGISTRY } from "../../../nodes/registry";

export function useDoubleClickBehavior(
  spec: ComponentSpec | null,
): Required<Pick<ReactFlowProps, "onNodeDoubleClick">> {
  const onNodeDoubleClick: NodeMouseHandler = (
    _event: React.MouseEvent,
    node: Node,
  ) => {
    if (!spec) return;
    const manifest = NODE_TYPE_REGISTRY.getByNodeId(spec, node.id);
    manifest?.onDoubleClick?.(spec, node);
  };

  return { onNodeDoubleClick };
}
