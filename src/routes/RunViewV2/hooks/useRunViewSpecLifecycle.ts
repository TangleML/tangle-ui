import { isRootStore, unregisterRootStore } from "mobx-keystone";
import { useEffect } from "react";

import type { ComponentSpec } from "@/models/componentSpec";

import { resetEditorState } from "../../EditorV2/store/editorStore";
import {
  clearNavigation,
  initNavigation,
} from "../../EditorV2/store/navigationStore";

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
