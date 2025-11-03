import { useConnection } from "@xyflow/react";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from "react";

import { useComponentLibrary } from "@/providers/ComponentLibraryProvider";

export const useGhostNode = () => {
  const connectionTo = useConnection((connection) => connection.to);
  const connectionToHandle = useConnection((connection) => connection.toHandle);
  const connectionFromHandle = useConnection(
    (connection) => connection.fromHandle,
  );
  const connectionInProgress = useConnection(
    (connection) => connection.inProgress,
  );

  const { searchResult, setHighlightedComponentDigest } = useComponentLibrary();
  const [tabCycleIndex, setTabCycleIndex] = useState(-1);

  const allSearchResults = useMemo(() => {
    if (!searchResult) return [];
    return [
      ...searchResult.components.user,
      ...searchResult.components.standard,
    ];
  }, [searchResult]);

  const activeSearchResult = useMemo(() => {
    if (tabCycleIndex >= 0 && tabCycleIndex < allSearchResults.length) {
      return allSearchResults[tabCycleIndex];
    }
    return null;
  }, [allSearchResults, tabCycleIndex]);

  const baseGhostNode = useMemo(() => {
    if (activeSearchResult) {
      return {
        id: "ghost-node-preview",
        type: "ghost",
        position: { x: 0, y: 0 },
        data: {
          componentRef: activeSearchResult,
          isGhost: true,
        },
        draggable: false,
        selectable: false,
        deletable: false,
        connectable: false,
        zIndex: 1000,
      };
    }
    return null;
  }, [activeSearchResult]);

  const ghostNode = useMemo(() => {
    if (
      baseGhostNode &&
      connectionInProgress &&
      !connectionToHandle &&
      connectionTo
    ) {
      const side = connectionFromHandle?.id?.includes("input")
        ? "left"
        : "right";

      return {
        ...baseGhostNode,
        position: connectionTo,
        data: {
          ...baseGhostNode.data,
          side,
        },
      };
    }
    return null;
  }, [
    baseGhostNode,
    connectionInProgress,
    connectionToHandle,
    connectionTo,
    connectionFromHandle,
  ]);

  const handleTabCycle = useCallback(
    (direction: "forward" | "back" = "forward") => {
      if (!connectionInProgress || !allSearchResults.length) return false;

      setTabCycleIndex((prev) => {
        if (direction === "forward") {
          const nextIndex = prev + 1;
          return nextIndex >= allSearchResults.length ? -1 : nextIndex;
        } else {
          const prevIndex = prev - 1;
          return prevIndex < -1 ? allSearchResults.length - 1 : prevIndex;
        }
      });

      return true;
    },
    [connectionInProgress, allSearchResults.length],
  );

  const resetGhostNodeState = useEffectEvent(() => {
    setTabCycleIndex(-1);
    setHighlightedComponentDigest(null);
  });

  useEffect(() => {
    if (!connectionInProgress) {
      resetGhostNodeState();
    }
  }, [connectionInProgress]);

  useEffect(() => {
    setHighlightedComponentDigest(activeSearchResult?.digest || null);
  }, [activeSearchResult, setHighlightedComponentDigest]);

  return {
    ghostNode,
    handleTabCycle,
  };
};
