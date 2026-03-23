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
import { getEffectiveSelection } from "@/routes/v2/shared/clipboard/getEffectiveSelection";
import { useNodeRegistry } from "@/routes/v2/shared/nodes/NodeRegistryContext";
import { CMDALT } from "@/routes/v2/shared/shortcuts/keys";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

export function useClipboardShortcuts(
  spec: ComponentSpec | null,
  containerRef: RefObject<HTMLDivElement | null>,
  reactFlowInstance: ReactFlowInstance | null,
): void {
  const registry = useNodeRegistry();
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
        const selection = getEffectiveSelection(registry, spec, editor);
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
        const selection = getEffectiveSelection(registry, spec, editor);
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
  }, [
    clipboard,
    spec,
    containerRef,
    reactFlowInstance,
    editor,
    keyboard,
    registry,
  ]);
}
