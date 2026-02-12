import { Handle, Position } from "@xyflow/react";
import { useConnection } from "@xyflow/react";
import { AlertCircle } from "lucide-react";
import { type MouseEvent, useCallback, useEffect, useState, useMemo } from "react";

import { useFlagValue } from "@/components/shared/Settings/useFlags";
import { cn } from "@/lib/utils";
import { useForcedSearchContext } from "@/providers/ComponentLibraryProvider/ForcedSearchProvider";
import { isValidFilterRequest } from "@/providers/ComponentLibraryProvider/types";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { useTaskNode } from "@/providers/TaskNodeProvider";
import { inputsWithInvalidArguments } from "@/services/componentService";
import { AGGREGATOR_ADD_INPUT_HANDLE_ID } from "@/utils/aggregatorInputs";
import { isPipelineAggregator } from "@/utils/annotations";
import {
  type InputSpec,
  isGraphInputArgument,
  isTaskOutputArgument,
} from "@/utils/componentSpec";
import { ComponentSearchFilter } from "@/utils/constants";
import { inputNameToNodeId } from "@/utils/nodes/nodeIdUtils";
import { checkArtifactMatchesSearchFilters } from "@/utils/searchUtils";

import { InputHandle } from "./Handles";
import { getDisplayValue } from "./handleUtils";

interface TaskNodeInputsProps {
  condensed: boolean;
  expanded: boolean;
  onBackgroundClick?: () => void;
}

export function TaskNodeInputs({
  condensed: condensedProp,
  expanded,
  onBackgroundClick,
}: TaskNodeInputsProps) {
  const taskNode = useTaskNode();
  const { inputs, taskSpec, state, select } = taskNode;
  const { graphSpec } = useComponentSpec();
  const isPipelineAggregatorEnabled = useFlagValue("pipeline-aggregator");
  const {
    highlightSearchFilter,
    resetSearchFilter,
    currentSearchFilter,
    highlightSearchResults,
  } = useForcedSearchContext();

  const connection = useConnection();

  const [isDragging, setIsDragging] = useState(false);

  const isAggregator =
    isPipelineAggregatorEnabled &&
    isPipelineAggregator(taskSpec?.componentRef?.spec?.metadata?.annotations);

  const internalInputs = useMemo(
    () => [AGGREGATOR_ADD_INPUT_HANDLE_ID],
    [],
  );

  const visibleInputs = useMemo(
    () => {
      const filtered = isAggregator
        ? inputs.filter((input) => !internalInputs.includes(input.name))
        : inputs;
      
      return filtered;
    },
    [isAggregator, inputs, internalInputs],
  );

  const values = taskSpec?.arguments;
  const invalidArguments = taskSpec
    ? inputsWithInvalidArguments(visibleInputs, taskSpec)
    : [];

  const connectedInputs = useMemo(
    () =>
      visibleInputs.filter(
        (input) =>
          isGraphInputArgument(values?.[input.name]) ||
          isTaskOutputArgument(values?.[input.name]),
      ),
    [visibleInputs, values],
  );

  const toggleHighlightRelatedHandles = useCallback(
    (selected: boolean, input?: InputSpec) => {
      if (selected && input) {
        const type = (input.type as string) || "[type undefined]";

        highlightSearchFilter({
          searchTerm: type,
          filters: [
            ComponentSearchFilter.OUTPUTTYPE,
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
      if (onBackgroundClick) {
        e.stopPropagation();
        onBackgroundClick();
      }
    },
    [onBackgroundClick],
  );

  const handleSelectionChange = useCallback(
    (inputName: string, selected: boolean) => {
      if (state.readOnly) return;

      const input = visibleInputs.find((i) => i.name === inputName);
      toggleHighlightRelatedHandles(selected, input);
    },
    [visibleInputs, state.readOnly, toggleHighlightRelatedHandles],
  );

  const checkHighlight = useCallback(
    (input: InputSpec) => {
      if (
        !highlightSearchResults ||
        !isValidFilterRequest(currentSearchFilter, {
          includesFilter: ComponentSearchFilter.INPUTTYPE,
        })
      ) {
        return false;
      }

      const matchFound = checkArtifactMatchesSearchFilters(
        currentSearchFilter.searchTerm,
        currentSearchFilter.filters,
        input,
      );

      return matchFound;
    },
    [currentSearchFilter, highlightSearchResults],
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

    const input = visibleInputs.find(
      (i) => inputNameToNodeId(i.name) === fromHandle?.id,
    );

    if (!input) return;

    toggleHighlightRelatedHandles(true, input);
    setIsDragging(true);
  }, [
    connection,
    visibleInputs,
    isDragging,
    resetSearchFilter,
    toggleHighlightRelatedHandles,
  ]);

  if (!taskSpec) {
    return null;
  }

  if (!visibleInputs.length && !isAggregator) return null;

  const displayInputs = useMemo(
    () => {
      // For aggregators, always show all visible inputs (not just connected ones)
      // This ensures handles exist for incoming connections
      if (isAggregator) {
        return visibleInputs;
      }
      
      // For regular components, show only connected inputs or the first input
      return connectedInputs.length === 0 && visibleInputs.length > 0
        ? [visibleInputs[0]]
        : connectedInputs;
    },
    [isAggregator, visibleInputs, connectedInputs],
  );

  const hiddenInputs = visibleInputs.length - displayInputs.length;
  const condensed = condensedProp && hiddenInputs >= 1;

  const hiddenInvalidArguments = invalidArguments.filter(
    (invalidArgument) =>
      !displayInputs.some((input) => input.name === invalidArgument),
  );

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 p-2 bg-gray-100 border border-gray-200 rounded-lg",
        condensed && onBackgroundClick && "hover:bg-gray-200/70 cursor-pointer",
      )}
      onClick={handleBackgroundClick}
    >
      {isAggregator && !state.readOnly && (
        <div className="relative w-full h-fit mb-1" key="add-input-handle">
          <div className="absolute -translate-x-6 flex items-center h-3 w-3">
            <Handle
              type="target"
              id={AGGREGATOR_ADD_INPUT_HANDLE_ID}
              position={Position.Left}
              isConnectable={true}
              className="border-0! h-full! w-full! transform-none! bg-blue-400!"
            />
          </div>
          <div className="flex flex-row items-center rounded-md relative">
            <div className="text-xs text-blue-600! rounded-md px-2 py-1 bg-blue-50 border border-blue-200 border-dashed">
              + Add Input
            </div>
          </div>
        </div>
      )}
      {condensed && !expanded ? (
        <>
          {displayInputs.map((input, i) => (
            <InputHandle
              key={input.name}
              input={input}
              invalid={invalidArguments.includes(input.name)}
              value={
                hiddenInputs > 0 && i === 0
                  ? `+${hiddenInputs} more input${hiddenInputs > 1 ? "s" : ""}`
                  : " "
              }
              onHandleSelectionChange={handleSelectionChange}
              highlight={checkHighlight(input)}
              onLabelClick={handleLabelClick}
            />
          ))}
          {hiddenInvalidArguments.length > 0 && (
            <div className="flex text-xs text-destructive-foreground mt-1 items-center">
              <AlertCircle className="h-4 w-4 inline-block mr-1" />
              <span>{`${hiddenInvalidArguments.length} hidden input${hiddenInvalidArguments.length > 1 ? "s have" : " has"} invalid arguments`}</span>
            </div>
          )}
        </>
      ) : (
        <>
          {visibleInputs.map((input) => (
            <InputHandle
              key={input.name}
              input={input}
              invalid={invalidArguments.includes(input.name)}
              value={getDisplayValue(values?.[input.name], graphSpec)}
              onHandleSelectionChange={handleSelectionChange}
              highlight={checkHighlight(input)}
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
