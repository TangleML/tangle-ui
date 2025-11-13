import { useConnection, useEdges } from "@xyflow/react";
import { type MouseEvent, useCallback, useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { useForcedSearchContext } from "@/providers/ComponentLibraryProvider/ForcedSearchProvider";
import { isValidFilterRequest } from "@/providers/ComponentLibraryProvider/types";
import { useTaskNode } from "@/providers/TaskNodeProvider";
import type { OutputSpec } from "@/utils/componentSpec";
import { ComponentSearchFilter } from "@/utils/constants";
import { outputNameToNodeId } from "@/utils/nodes/nodeIdUtils";
import { checkArtifactMatchesSearchFilters } from "@/utils/searchUtils";

import { useConnectionHighlighting } from "../../hooks/useConnectionHighlighting";
import { getOutputHandleId, OutputHandle } from "./Handles";

type TaskNodeOutputsProps = {
  condensed: boolean;
  expanded: boolean;
  onBackgroundClick?: () => void;
};

export function TaskNodeOutputs({
  condensed,
  expanded,
  onBackgroundClick,
}: TaskNodeOutputsProps) {
  const { nodeId, outputs, state, select } = useTaskNode();
  const {
    highlightSearchFilter,
    resetSearchFilter,
    currentSearchFilter,
    highlightSearchResults,
  } = useForcedSearchContext();

  const { highlightConnections, clearHighlights, isHandleHighlighted } =
    useConnectionHighlighting();

  const connection = useConnection();
  const edges = useEdges();

  const [isDragging, setIsDragging] = useState(false);

  const outputsWithTaskInput = outputs.filter((output) =>
    edges.some(
      (edge) =>
        edge.source === nodeId &&
        edge.sourceHandle === outputNameToNodeId(output.name),
    ),
  );

  const toggleHighlightRelatedHandles = useCallback(
    (selected: boolean, output?: OutputSpec) => {
      if (selected && output) {
        const type = (output.type as string) || "[type undefined]";

        highlightSearchFilter({
          searchTerm: type,
          filters: [
            ComponentSearchFilter.INPUTTYPE,
            ComponentSearchFilter.EXACTMATCH,
          ],
        });
      } else {
        resetSearchFilter();
      }
    },
    [highlightSearchFilter, resetSearchFilter],
  );

  const handleBackgroundClick = useCallback(
    (e: MouseEvent) => {
      if (condensed && onBackgroundClick) {
        e.stopPropagation();
        onBackgroundClick();
      }
    },
    [condensed, onBackgroundClick],
  );

  const handleSelectionChange = useCallback(
    (outputName: string, selected: boolean) => {
      if (state.readOnly) return;

      const output = outputs.find((o) => o.name === outputName);

      if (selected) {
        // Search-based highlighting (green)
        toggleHighlightRelatedHandles(true, output);

        // Connection-based highlighting (pink)
        const handleId = getOutputHandleId(outputName);
        highlightConnections(nodeId, handleId, "output");
      } else {
        resetSearchFilter();
        clearHighlights();
      }
    },
    [
      outputs,
      state.readOnly,
      toggleHighlightRelatedHandles,
      nodeId,
      highlightConnections,
      clearHighlights,
      resetSearchFilter,
    ],
  );

  const checkHighlight = useCallback(
    (output: OutputSpec) => {
      // Search-based highlighting (green)
      const searchHighlight =
        highlightSearchResults &&
        isValidFilterRequest(currentSearchFilter, {
          includesFilter: ComponentSearchFilter.OUTPUTTYPE,
        }) &&
        checkArtifactMatchesSearchFilters(
          currentSearchFilter.searchTerm,
          currentSearchFilter.filters,
          output,
        );

      // Connection-based highlighting (pink)
      const handleId = getOutputHandleId(output.name);
      const connectionHighlight = isHandleHighlighted(nodeId, handleId);

      return {
        searchHighlight,
        connectionHighlight,
      };
    },
    [highlightSearchResults, currentSearchFilter, isHandleHighlighted, nodeId],
  );

  const handleLabelClick = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      select();
    },
    [select],
  );

  useEffect(() => {
    // Highlight relevant Handles when the user drags a new connection
    const { fromHandle, from, to, inProgress } = connection;

    if (!inProgress) {
      resetSearchFilter();
      setIsDragging(false);
      return;
    }

    if (isDragging) {
      return;
    }

    if (
      from &&
      to &&
      Math.sqrt(Math.pow(from.x - to.x, 2) + Math.pow(from.y - to.y, 2)) < 4
    ) {
      // If the user has dragged the cursor less than 4px from the click origin, then assume it is a click event on the Handle
      setIsDragging(false);
      return;
    }

    const output = outputs.find(
      (o) => outputNameToNodeId(o.name) === fromHandle?.id,
    );

    if (!output) return;

    toggleHighlightRelatedHandles(true, output);
    setIsDragging(true);
  }, [
    connection,
    outputs,
    isDragging,
    toggleHighlightRelatedHandles,
    resetSearchFilter,
  ]);

  if (!outputs.length) return null;

  if (outputsWithTaskInput.length === 0) {
    outputsWithTaskInput.push(outputs[0]);
  }

  const hiddenOutputs = outputs.length - outputsWithTaskInput.length;
  if (hiddenOutputs < 1) {
    condensed = false;
  }

  return (
    <div
      className={cn(
        "flex flex-col justify-end items-center gap-3 p-2 bg-gray-100 border-1 border-gray-200 rounded-lg",
        condensed && onBackgroundClick && "hover:bg-gray-200/70 cursor-pointer",
      )}
      onClick={handleBackgroundClick}
    >
      {condensed && !expanded ? (
        outputsWithTaskInput.map((output, i) => (
          <OutputHandle
            key={output.name}
            output={output}
            value={
              hiddenOutputs > 0 && i === 0
                ? `+${hiddenOutputs} more output${hiddenOutputs > 1 ? "s" : ""}`
                : " "
            }
            onHandleSelectionChange={handleSelectionChange}
            highlight={checkHighlight(output)}
            onLabelClick={handleLabelClick}
          />
        ))
      ) : (
        <>
          {outputs.map((output) => (
            <OutputHandle
              key={output.name}
              output={output}
              onHandleSelectionChange={handleSelectionChange}
              highlight={checkHighlight(output)}
              onLabelClick={handleLabelClick}
            />
          ))}
          {condensed && (
            <span className="text-xs text-gray-400 mt-1">
              (Click to collapse)
            </span>
          )}
        </>
      )}
    </div>
  );
}
