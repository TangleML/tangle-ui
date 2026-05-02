import type { OnBeforeDelete } from "@xyflow/react";

import type { ComponentSpec } from "@/models/componentSpec";
import {
  type FlowCanvasDeleteDeps,
  runFlowCanvasOnBeforeDelete,
} from "@/routes/v2/pages/Editor/components/FlowCanvas/canvasDeleteSelection";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { useNodeRegistry } from "@/routes/v2/shared/nodes/NodeRegistryContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

/**
 * `onBeforeDelete` for React Flow: applies editor/spec deletion and aborts RF’s
 * internal removal so controlled `nodes`/`edges` stay spec-driven.
 */
export function useFlowCanvasOnBeforeDelete(
  spec: ComponentSpec | null,
): OnBeforeDelete {
  const { editor, navigation } = useSharedStores();
  const { undo } = useEditorSession();
  const registry = useNodeRegistry();

  return (params) =>
    runFlowCanvasOnBeforeDelete(
      {
        spec,
        undo,
        editor,
        parentContext: navigation.parentContext,
        registry,
      } satisfies FlowCanvasDeleteDeps,
      params,
    );
}
