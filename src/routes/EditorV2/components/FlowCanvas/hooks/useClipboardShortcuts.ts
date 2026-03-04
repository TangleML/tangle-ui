import type { ReactFlowInstance } from "@xyflow/react";
import type { RefObject } from "react";
import { useEffect } from "react";

import type { ComponentSpec } from "@/models/componentSpec";

import {
  copySelectedNodes,
  duplicateSelectedNodes,
  findEntityById,
  pasteNodes,
} from "../../../store/actions";
import { editorStore, type SelectedNode } from "../../../store/editorStore";

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
    // todo: introduce hotkey manager for central handling of hotkeys
    const onKeyDown = (e: KeyboardEvent) => {
      if (!spec) return;

      const isModKey = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement;
      const isInputFocused =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if (isInputFocused || !isModKey) return;

      const selection = getEffectiveSelection(spec);

      if (e.key === "d") {
        e.preventDefault();
        if (selection.length > 0) duplicateSelectedNodes(spec, selection);
      } else if (e.key === "c") {
        e.preventDefault();
        if (selection.length > 0) copySelectedNodes(spec, selection);
      } else if (e.key === "v") {
        e.preventDefault();
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect && reactFlowInstance) {
          const center = reactFlowInstance.screenToFlowPosition({
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          });
          pasteNodes(spec, center);
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });
}
