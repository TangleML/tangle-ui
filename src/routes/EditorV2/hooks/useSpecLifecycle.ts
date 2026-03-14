import { autorun } from "mobx";
import type { UndoStore as MobxUndoStore } from "mobx-keystone";
import { isRootStore, unregisterRootStore } from "mobx-keystone";
import { useEffect, useRef } from "react";

import type { ComponentSpec } from "@/models/componentSpec";

import { autoSaveStore } from "../store/autoSaveStore";
import { editorStore, resetEditorState } from "../store/editorStore";
import { clearNavigation, initNavigation } from "../store/navigationStore";
import { undoStore } from "../store/undoStore";
import { closeWindowsByLinkedEntity } from "../windows/windows.actions";

export function useSpecLifecycle(
  rootSpec: ComponentSpec,
  pipelineName: string | null,
  restoredUndoStore?: MobxUndoStore,
) {
  const prevTaskEntityIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (rootSpec) {
      resetEditorState();
      initNavigation(rootSpec);
      undoStore.init(rootSpec, restoredUndoStore);

      const saveName = pipelineName ?? rootSpec.name;
      if (saveName) {
        autoSaveStore.init(rootSpec, saveName);
      }

      prevTaskEntityIdsRef.current = new Set(rootSpec.tasks.map((t) => t.$id));

      const disposeTaskWatcher = autorun(() => {
        const currentTaskIds = new Set(rootSpec.tasks.map((t) => t.$id));

        for (const prevId of prevTaskEntityIdsRef.current) {
          if (!currentTaskIds.has(prevId)) {
            closeWindowsByLinkedEntity(prevId);
          }
        }

        prevTaskEntityIdsRef.current = currentTaskIds;
      });

      return () => {
        disposeTaskWatcher();
        autoSaveStore.dispose();
        editorStore.clearSelection();
        clearNavigation();
        undoStore.dispose();
        if (isRootStore(rootSpec)) {
          unregisterRootStore(rootSpec);
        }
      };
    }
  }, [rootSpec, pipelineName, restoredUndoStore]);
}
