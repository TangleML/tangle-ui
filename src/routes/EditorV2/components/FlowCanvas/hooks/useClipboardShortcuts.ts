import type { ReactFlowInstance } from "@xyflow/react";
import type { RefObject } from "react";
import { useEffect } from "react";

import type { ComponentSpec } from "@/models/componentSpec";

import { CMDALT } from "../../../shortcuts/keys";
import {
  copySelectedNodes,
  duplicateSelectedNodes,
  findEntityById,
  pasteNodes,
} from "../../../store/actions";
import { editorStore, type SelectedNode } from "../../../store/editorStore";
import { registerShortcut } from "../../../store/keyboardStore";

/**
 * Returns the current effective selection: multiSelection if multiple nodes
 * are selected, or a single-element array built from selectedNodeId when
 * exactly one node is selected.
 */
function getEffectiveSelection(spec: ComponentSpec): SelectedNode[] {
  const { multiSelection, selectedNodeId, selectedNodeType } = editorStore;
  if (multiSelection.length > 0) return multiSelection;

  if (!selectedNodeId || !selectedNodeType) return [];

  const entity = findEntityById(spec, selectedNodeId);
  if (!entity) return [];

  const position = entity.annotations.get("editor.position");
  return [{ id: selectedNodeId, type: selectedNodeType, position }];
}

export function useClipboardShortcuts(
  spec: ComponentSpec | null,
  containerRef: RefObject<HTMLDivElement | null>,
  reactFlowInstance: ReactFlowInstance | null,
): void {
  useEffect(() => {
    const unregisterDuplicate = registerShortcut({
      id: "duplicate",
      keys: [CMDALT, "D"],
      label: "Duplicate",
      action: (e) => {
        e.preventDefault();
        if (!spec) return;
        const selection = getEffectiveSelection(spec);
        if (selection.length > 0) duplicateSelectedNodes(spec, selection);
      },
    });

    const unregisterCopy = registerShortcut({
      id: "copy",
      keys: [CMDALT, "C"],
      label: "Copy",
      action: (e) => {
        e.preventDefault();
        if (!spec) return;
        const selection = getEffectiveSelection(spec);
        if (selection.length > 0) copySelectedNodes(spec, selection);
      },
    });

    const unregisterPaste = registerShortcut({
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
          pasteNodes(spec, center);
        }
      },
    });

    return () => {
      unregisterDuplicate();
      unregisterCopy();
      unregisterPaste();
    };
  });
}
