import { useEffect } from "react";

import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { DEFAULT_VIEW_PRESET } from "@/routes/v2/shared/windows/viewPresets";
import { loadWindowLayout } from "@/routes/v2/shared/windows/windowPersistence";

/**
 * On first editor visit (no window layout in localStorage), reorder dock stacks
 * to match `DEFAULT_VIEW_PRESET`.
 *
 * Must run in an effect declared after the editor `use*Window` hooks in
 * `PipelineEditor` so those hooks’ effects have already opened windows in the
 * store. Only runs when this editor has no saved layout.
 */
export function useSeedInitialDockLayoutFromPreset(): void {
  const { windows } = useSharedStores();

  useEffect(() => {
    if (!loadWindowLayout(windows.layoutId)) {
      windows.seedInitialDockLayoutFromPreset(DEFAULT_VIEW_PRESET);
    }
  }, [windows]);
}
