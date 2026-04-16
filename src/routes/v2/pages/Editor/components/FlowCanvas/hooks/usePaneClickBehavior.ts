import type { ReactFlowInstance, ReactFlowProps } from "@xyflow/react";
import type { MouseEvent as ReactMouseEvent } from "react";

import type { ComponentSpec } from "@/models/componentSpec";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { useNodeRegistry } from "@/routes/v2/shared/nodes/NodeRegistryContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

export function usePaneClickBehavior(
  spec: ComponentSpec | null,
  reactFlowInstance: ReactFlowInstance | null,
): Required<Pick<ReactFlowProps, "onPaneClick">> {
  const registry = useNodeRegistry();
  const { editor, keyboard } = useSharedStores();
  const { undo } = useEditorSession();

  const onPaneClick = (event: ReactMouseEvent) => {
    editor.clearSelection();

    if (!spec || !reactFlowInstance) return;

    const position = reactFlowInstance.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    for (const manifest of registry.all()) {
      manifest.onPaneClick?.(spec, position, { editor, keyboard, undo });
    }
  };

  return { onPaneClick };
}
