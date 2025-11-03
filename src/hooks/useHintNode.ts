import type { Node } from "@xyflow/react";
import { useConnection } from "@xyflow/react";

import { useBetaFlagValue } from "@/components/shared/Settings/useBetaFlags";
import { useComponentLibrary } from "@/providers/ComponentLibraryProvider";
import type { HintNodeData } from "@/types/hintNode";

const HINT_NODE_ID = "hint-node";

export const useHintNode = ({ key, hint }: { key: string; hint: string }) => {
  const isRemoteComponentLibraryEnabled = useBetaFlagValue(
    "remote-component-library-search",
  );

  const connectionTo = useConnection((connection) => connection.to);
  const connectionToHandle = useConnection((connection) => connection.toHandle);
  const connectionFromHandle = useConnection(
    (connection) => connection.fromHandle,
  );
  const connectionInProgress = useConnection(
    (connection) => connection.inProgress,
  );

  const { searchResult } = useComponentLibrary();

  const hasResults =
    searchResult &&
    (searchResult.components.standard.length > 0 ||
      searchResult.components.user.length > 0);

  const isOverValidTarget = connectionInProgress && connectionToHandle !== null;

  const shouldShowHint =
    connectionInProgress && hasResults && !isOverValidTarget;

  const hintNode: Node<HintNodeData> | null = (() => {
    /**
     * Turning off hint node for remote component library
     * Todo: it will be addressed in a follow PRs, when we can search "input/output" remotely,
     *  or when we can search all libs at once
     */
    if (isRemoteComponentLibraryEnabled || !shouldShowHint || !connectionTo) {
      return null;
    }

    const side = connectionFromHandle?.id?.includes("input") ? "left" : "right";

    return {
      id: HINT_NODE_ID + "-" + key,
      type: "hint",
      position: connectionTo,
      data: {
        key,
        hint,
        side,
      },
      draggable: false,
      selectable: false,
      deletable: false,
      connectable: false,
      focusable: false,
      zIndex: 1000,
    };
  })();

  return hintNode;
};
