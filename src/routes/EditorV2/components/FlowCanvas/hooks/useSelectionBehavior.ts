import type {
  Node,
  OnSelectionChangeParams,
  ReactFlowProps,
} from "@xyflow/react";
import { useEffect } from "react";

import { debounce } from "@/utils/debounce";

import {
  clearMultiSelection,
  clearSelection,
  type SelectedNode,
  setMultiSelection,
} from "../../../store/editorStore";

const SELECTION_DEBOUNCE_MS = 150;

function buildMultiSelection(selected: Node[]): SelectedNode[] {
  return selected
    .filter((node) => node.type === "task" || node.type === "io")
    .map((node) => {
      let nodeType: SelectedNode["type"];
      if (node.type === "task") {
        nodeType = "task";
      } else {
        nodeType = node.data?.ioType === "input" ? "input" : "output";
      }
      return { id: node.id, type: nodeType, position: node.position };
    });
}

const debouncedSetMultiSelection = debounce(
  (nodes: SelectedNode[]) => setMultiSelection(nodes),
  SELECTION_DEBOUNCE_MS,
);

export function useSelectionBehavior(): Required<
  Pick<ReactFlowProps, "onSelectionChange" | "onPaneClick">
> {
  useEffect(() => {
    return () => debouncedSetMultiSelection.cancel();
  }, []);

  const onSelectionChange = ({ nodes: selected }: OnSelectionChangeParams) => {
    if (selected.length > 1) {
      debouncedSetMultiSelection(buildMultiSelection(selected));
    } else {
      debouncedSetMultiSelection.cancel();
      clearMultiSelection();
    }
  };

  const onPaneClick = () => {
    clearSelection();
  };

  return { onSelectionChange, onPaneClick };
}
