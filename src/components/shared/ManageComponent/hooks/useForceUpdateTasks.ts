import type { HydratedComponentReference } from "@/utils/componentSpec";

import { useDialogContext } from "../../Dialogs/dialog.context";
import { useNodesOverlay } from "../../ReactFlow/NodesOverlay/NodesOverlayProvider";

export function useForceUpdateTasks(
  currentComponent: HydratedComponentReference | null,
) {
  const dialogContext = useDialogContext();
  const { notifyNode, getNodeIdsByDigest, fitNodeIntoView } = useNodesOverlay();

  return async (digest: string) => {
    if (!currentComponent) {
      return;
    }

    const nodeIds = getNodeIdsByDigest(digest);

    if (nodeIds.length === 0) {
      return;
    }

    const nodeId = nodeIds.pop();

    if (!nodeId) {
      return;
    }

    // close current dialog?
    dialogContext?.close();

    await fitNodeIntoView(nodeId);

    notifyNode(nodeId, {
      type: "update-overlay",
      data: {
        replaceWith: new Map([[digest, currentComponent]]),
        ids: nodeIds,
      },
    });
  };
}
