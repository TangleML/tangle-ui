import { isRootStore, unregisterRootStore } from "mobx-keystone";
import { useEffect } from "react";

import type { ComponentSpec } from "@/models/componentSpec";
import { resetEditorState } from "@/routes/v2/shared/store/editorStore";
import {
  clearNavigation,
  initNavigation,
} from "@/routes/v2/shared/store/navigationStore";

export function useRunViewSpecLifecycle(rootSpec: ComponentSpec) {
  useEffect(() => {
    if (!rootSpec) return;

    resetEditorState();
    initNavigation(rootSpec);

    return () => {
      clearNavigation();
      resetEditorState();
      if (isRootStore(rootSpec)) {
        unregisterRootStore(rootSpec);
      }
    };
  }, [rootSpec]);
}
