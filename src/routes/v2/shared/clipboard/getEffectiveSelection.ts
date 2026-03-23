import type { ComponentSpec } from "@/models/componentSpec";
import type { NodeTypeRegistry } from "@/routes/v2/shared/nodes/registry";
import type {
  EditorStore,
  SelectedNode,
} from "@/routes/v2/shared/store/editorStore";

/**
 * Returns the current effective selection: multiSelection if multiple nodes
 * are selected, or a single-element array built from selectedNodeId when
 * exactly one node is selected.
 */
export function getEffectiveSelection(
  registry: NodeTypeRegistry,
  spec: ComponentSpec,
  editor: EditorStore,
): SelectedNode[] {
  const { multiSelection, selectedNodeId, selectedNodeType } = editor;
  if (multiSelection.length > 0) return multiSelection;

  if (!selectedNodeId || !selectedNodeType) return [];

  const position = registry
    .getByNodeId(spec, selectedNodeId)
    ?.getPosition(spec, selectedNodeId);

  if (!position) return [];

  return [{ id: selectedNodeId, type: selectedNodeType, position }];
}
