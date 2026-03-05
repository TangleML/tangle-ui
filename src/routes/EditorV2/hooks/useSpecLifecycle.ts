import { autorun } from "mobx";
import { isRootStore, unregisterRootStore } from "mobx-keystone";
import { useEffect, useRef } from "react";

import type { ComponentSpec } from "@/models/componentSpec";

import { autoSaveStore } from "../store/autoSaveStore";
import { clearSpec, editorStore, initializeStore } from "../store/editorStore";
import { historyStore } from "../store/historyStore";
import { clearNavigation, initNavigation } from "../store/navigationStore";
import { undoStore } from "../store/undoStore";
import { closeWindowsByLinkedEntity } from "../windows/windowStore";

export function useSpecLifecycle(
  rootSpec: ComponentSpec,
  pipelineName: string | null,
) {
  const prevTaskEntityIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (rootSpec) {
      initializeStore(rootSpec);
      initNavigation(rootSpec);
      undoStore.init(rootSpec);

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
        clearSpec();
        editorStore.clearSelection();
        clearNavigation();
        historyStore.clear();
        undoStore.dispose();
        if (isRootStore(rootSpec)) {
          unregisterRootStore(rootSpec);
        }
      };
    }
  }, [rootSpec, pipelineName]);
}
