import { useEffect } from "react";

import type { ComponentSpec } from "@/models/componentSpec";
import { copyNodesToClipboard } from "@/routes/v2/shared/clipboard/copyNodesToClipboard";
import { getEffectiveSelection } from "@/routes/v2/shared/clipboard/getEffectiveSelection";
import { useNodeRegistry } from "@/routes/v2/shared/nodes/NodeRegistryContext";
import { CMDALT } from "@/routes/v2/shared/shortcuts/keys";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

export function useCopyShortcut(spec: ComponentSpec | null): void {
  const registry = useNodeRegistry();
  const { editor, keyboard } = useSharedStores();

  useEffect(() => {
    const unregister = keyboard.registerShortcut({
      id: "copy",
      keys: [CMDALT, "C"],
      label: "Copy",
      action: (e) => {
        e.preventDefault();
        if (!spec) return;
        const selection = getEffectiveSelection(registry, spec, editor);
        if (selection.length > 0) {
          copyNodesToClipboard(registry, spec, selection);
        }
      },
    });

    return unregister;
  }, [spec, registry, editor, keyboard]);
}
