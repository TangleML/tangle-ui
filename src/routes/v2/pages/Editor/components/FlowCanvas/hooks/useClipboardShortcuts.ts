import type { ReactFlowInstance } from "@xyflow/react";
import type { RefObject } from "react";
import { useEffect } from "react";

import useToastNotification from "@/hooks/useToastNotification";
import type { ComponentSpec } from "@/models/componentSpec";
import {
  copySelectedNodes,
  duplicateSelectedNodes,
  pasteNodes,
} from "@/routes/v2/pages/Editor/store/actions";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { readPasteEventClipboardInfo } from "@/routes/v2/shared/clipboard/clipboardEnvelope";
import {
  CLIPBOARD_COPY_FAILED_MESSAGE,
  CLIPBOARD_READ_FAILED_MESSAGE,
} from "@/routes/v2/shared/clipboard/clipboardMessages";
import { getEffectiveSelection } from "@/routes/v2/shared/clipboard/getEffectiveSelection";
import { useNodeRegistry } from "@/routes/v2/shared/nodes/NodeRegistryContext";
import { CMDALT } from "@/routes/v2/shared/shortcuts/keys";
import {
  isDialogOpen,
  isEditableTarget,
} from "@/routes/v2/shared/shortcuts/shortcutUtils";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

export function useClipboardShortcuts(
  spec: ComponentSpec | null,
  containerRef: RefObject<HTMLDivElement | null>,
  reactFlowInstance: ReactFlowInstance | null,
): void {
  const registry = useNodeRegistry();
  const { editor, keyboard } = useSharedStores();
  const { clipboard } = useEditorSession();
  const notify = useToastNotification();

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
        const textSelection = window.getSelection();
        if (
          textSelection &&
          !textSelection.isCollapsed &&
          textSelection.toString().length > 0
        ) {
          return false;
        }
        e.preventDefault();
        if (!spec) return;
        const selection = getEffectiveSelection(registry, spec, editor);
        if (selection.length === 0) return;
        copySelectedNodes(clipboard, spec, selection).catch(() =>
          notify(CLIPBOARD_COPY_FAILED_MESSAGE, "error"),
        );
      },
    });

    const unregisterPaste = keyboard.registerShortcut({
      id: "paste",
      keys: [CMDALT, "V"],
      label: "Paste",
      // Returning false skips preventDefault, so the browser still fires the
      // `paste` event the listener below depends on.
      action: () => false,
    });

    return () => {
      unregisterDuplicate();
      unregisterCopy();
      unregisterPaste();
    };
  }, [clipboard, spec, editor, keyboard, registry, notify]);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      if (!spec || isEditableTarget(event.target) || isDialogOpen()) return;

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || !reactFlowInstance) return;

      const read = readPasteEventClipboardInfo(event);
      event.preventDefault();

      const center = reactFlowInstance.screenToFlowPosition({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });

      void pasteNodes(clipboard, spec, center, read).catch(() =>
        notify(CLIPBOARD_READ_FAILED_MESSAGE, "error"),
      );
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [clipboard, spec, containerRef, reactFlowInstance, notify]);
}
