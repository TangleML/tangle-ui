import "@/routes/EditorV2/nodes"; // ensure manifests are registered

import type {
  Node,
  OnSelectionChangeParams,
  ReactFlowProps,
} from "@xyflow/react";
import { useEffect } from "react";

import type { ComponentSpec } from "@/models/componentSpec/entities/componentSpec";
import { NODE_TYPE_REGISTRY } from "@/routes/EditorV2/nodes/registry";
import {
  clearMultiSelection,
  type SelectedNode,
  setMultiSelection,
} from "@/routes/EditorV2/store/editorStore";
import { debounce } from "@/utils/debounce";

const SELECTION_DEBOUNCE_MS = 150;

function buildMultiSelection(
  spec: ComponentSpec | null,
  selected: Node[],
): SelectedNode[] {
  const result: SelectedNode[] = [];
  for (const node of selected) {
    const manifest = NODE_TYPE_REGISTRY.getByNodeId(spec, node.id);
    if (!manifest?.selectable) continue;
    const selectedNode = manifest.toSelectedNode?.(node);
    if (selectedNode) result.push(selectedNode);
  }
  return result;
}

const debouncedSetMultiSelection = debounce(
  (nodes: SelectedNode[]) => setMultiSelection(nodes),
  SELECTION_DEBOUNCE_MS,
);

export function useSelectionBehavior(
  spec: ComponentSpec | null,
): Required<Pick<ReactFlowProps, "onSelectionChange">> {
  useEffect(() => {
    return () => debouncedSetMultiSelection.cancel();
  }, []);

  const onSelectionChange = ({ nodes: selected }: OnSelectionChangeParams) => {
    if (selected.length > 1) {
      debouncedSetMultiSelection(buildMultiSelection(spec, selected));
    } else {
      debouncedSetMultiSelection.cancel();
      clearMultiSelection();
    }
  };

  return { onSelectionChange };
}
