import type { ComponentSpec } from "@/models/componentSpec";
import type { NodeTypeRegistry } from "@/routes/v2/shared/nodes/registry";
import type {
  EditorStore,
  SelectedNode,
} from "@/routes/v2/shared/store/editorStore";

/** Resolve current geometry from the document when copying or duplicating. */
export function getEffectiveSelection(
  registry: NodeTypeRegistry,
  spec: ComponentSpec,
  editor: EditorStore,
): SelectedNode[] {
  return editor.selectedNodes.flatMap((node) => {
    const position = registry
      .getByNodeId(spec, node.id)
      ?.getPosition(spec, node.id);
    return position ? [{ ...node, position }] : [];
  });
}
