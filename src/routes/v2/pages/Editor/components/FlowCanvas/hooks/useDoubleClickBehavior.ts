import type { Node, NodeMouseHandler, ReactFlowProps } from "@xyflow/react";

import type { ComponentSpec } from "@/models/componentSpec";
import { useNodeRegistry } from "@/routes/v2/shared/nodes/NodeRegistryContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

export function useDoubleClickBehavior(
  spec: ComponentSpec | null,
): Required<Pick<ReactFlowProps, "onNodeDoubleClick">> {
  const registry = useNodeRegistry();
  const { navigation } = useSharedStores();

  const onNodeDoubleClick: NodeMouseHandler = (
    _event: React.MouseEvent,
    node: Node,
  ) => {
    if (!spec) return;
    const manifest = registry.getByNodeId(spec, node.id);
    manifest?.onDoubleClick?.(spec, node, navigation);
  };

  return { onNodeDoubleClick };
}
