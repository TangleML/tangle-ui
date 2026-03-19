import type {
  Node,
  OnSelectionChangeParams,
  ReactFlowProps,
} from "@xyflow/react";
import { useEffect } from "react";

import type { ComponentSpec } from "@/models/componentSpec/entities/componentSpec";
import { NODE_TYPE_REGISTRY } from "@/routes/v2/shared/nodes/registry";
import type { SelectedNode } from "@/routes/v2/shared/store/editorStore";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
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

export function useSelectionBehavior(
  spec: ComponentSpec | null,
): Required<Pick<ReactFlowProps, "onSelectionChange">> {
  const { editor } = useSharedStores();

  const debouncedSetMultiSelection = debounce(
    (nodes: SelectedNode[]) => editor.setMultiSelection(nodes),
    SELECTION_DEBOUNCE_MS,
  );

  useEffect(() => {
    return () => debouncedSetMultiSelection.cancel();
  }, [debouncedSetMultiSelection]);

  const onSelectionChange = ({ nodes: selected }: OnSelectionChangeParams) => {
    if (selected.length > 1) {
      debouncedSetMultiSelection(buildMultiSelection(spec, selected));
    } else {
      debouncedSetMultiSelection.cancel();
      editor.clearMultiSelection();
    }
  };

  return { onSelectionChange };
}
