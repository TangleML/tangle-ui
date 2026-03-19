import type { ReactFlowInstance } from "@xyflow/react";
import type { RefObject } from "react";
import { useEffect } from "react";

import type { ComponentSpec } from "@/models/componentSpec";
import {
  copySelectedNodes,
  duplicateSelectedNodes,
  pasteNodes,
} from "@/routes/v2/pages/Editor/store/actions";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { NODE_TYPE_REGISTRY } from "@/routes/v2/shared/nodes/registry";
import { CMDALT } from "@/routes/v2/shared/shortcuts/keys";
import type {
  EditorStore,
  SelectedNode,
} from "@/routes/v2/shared/store/editorStore";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

/**
 * Returns the current effective selection: multiSelection if multiple nodes
 * are selected, or a single-element array built from selectedNodeId when
 * exactly one node is selected.
 */
function getEffectiveSelection(
  spec: ComponentSpec,
  editor: EditorStore,
): SelectedNode[] {
  const { multiSelection, selectedNodeId, selectedNodeType } = editor;
  if (multiSelection.length > 0) return multiSelection;

  if (!selectedNodeId || !selectedNodeType) return [];

  const position = NODE_TYPE_REGISTRY.getByNodeId(
    spec,
    selectedNodeId,
  )?.getPosition(spec, selectedNodeId);

  if (!position) return [];

  return [{ id: selectedNodeId, type: selectedNodeType, position }];
}

export function useClipboardShortcuts(
  spec: ComponentSpec | null,
  containerRef: RefObject<HTMLDivElement | null>,
  reactFlowInstance: ReactFlowInstance | null,
): void {
  const { editor, keyboard } = useSharedStores();
  const { clipboard } = useEditorSession();

  useEffect(() => {
    const unregisterDuplicate = keyboard.registerShortcut({
      id: "duplicate",
      keys: [CMDALT, "D"],
      label: "Duplicate",
      action: (e) => {
        e.preventDefault();
        if (!spec) return;
        const selection = getEffectiveSelection(spec, editor);
        if (selection.length > 0)
          duplicateSelectedNodes(clipboard, spec, selection);
      },
    });

    const unregisterCopy = keyboard.registerShortcut({
      id: "copy",
      keys: [CMDALT, "C"],
      label: "Copy",
      action: (e) => {
        e.preventDefault();
        if (!spec) return;
        const selection = getEffectiveSelection(spec, editor);
        if (selection.length > 0) copySelectedNodes(clipboard, spec, selection);
      },
    });

    const unregisterPaste = keyboard.registerShortcut({
      id: "paste",
      keys: [CMDALT, "V"],
      label: "Paste",
      action: (e) => {
        e.preventDefault();
        if (!spec) return;
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect && reactFlowInstance) {
          const center = reactFlowInstance.screenToFlowPosition({
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          });
          void pasteNodes(clipboard, spec, center);
        }
      },
    });

    return () => {
      unregisterDuplicate();
      unregisterCopy();
      unregisterPaste();
    };
  }, [clipboard, spec, containerRef, reactFlowInstance, editor, keyboard]);
}
