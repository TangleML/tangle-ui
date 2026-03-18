import "@/routes/EditorV2/nodes"; // ensure manifests are registered

import type { ReactFlowInstance, ReactFlowProps } from "@xyflow/react";
import type { MouseEvent as ReactMouseEvent } from "react";

import type { ComponentSpec } from "@/models/componentSpec";
import { NODE_TYPE_REGISTRY } from "@/routes/EditorV2/nodes/registry";
import { clearSelection } from "@/routes/EditorV2/store/editorStore";

export function usePaneClickBehavior(
  spec: ComponentSpec | null,
  reactFlowInstance: ReactFlowInstance | null,
): Required<Pick<ReactFlowProps, "onPaneClick">> {
  const onPaneClick = (event: ReactMouseEvent) => {
    clearSelection();

    if (!spec || !reactFlowInstance) return;

    const position = reactFlowInstance.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    for (const manifest of NODE_TYPE_REGISTRY.all()) {
      manifest.onPaneClick?.(spec, position);
    }
  };

  return { onPaneClick };
}
