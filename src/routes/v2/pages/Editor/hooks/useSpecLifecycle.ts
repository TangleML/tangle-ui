import { autorun } from "mobx";
import type { UndoStore as MobxUndoStore } from "mobx-keystone";
import { isRootStore, unregisterRootStore } from "mobx-keystone";
import { useEffect, useRef } from "react";

import type { ComponentSpec } from "@/models/componentSpec";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import type { PipelineStorageService } from "@/services/pipelineStorage/PipelineStorageService";
import type { PipelineRef } from "@/services/pipelineStorage/types";

/**
 * todo: make public and export to re-use
 */
async function resolvePipelineFile(
  ref: PipelineRef,
  storage: PipelineStorageService,
) {
  if (ref.fileId) {
    return storage.findPipelineById(ref.fileId);
  }
  return storage.resolvePipelineByName(ref.name);
}

export function useSpecLifecycle(
  rootSpec: ComponentSpec,
  pipelineRef: PipelineRef,
  restoredUndoStore?: MobxUndoStore,
) {
  const { editor, navigation, windows: windowStore } = useSharedStores();
  const {
    undo,
    autoSave,
    pipelineFile: pipelineFileStore,
  } = useEditorSession();
  const storage = usePipelineStorage();
  const prevTaskEntityIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!rootSpec) return;

    editor.resetState();
    navigation.initNavigation(rootSpec);
    undo.init(rootSpec, restoredUndoStore);

    const saveName = pipelineRef.name ?? rootSpec.name;

    void (async () => {
      if (saveName) {
        const file = await resolvePipelineFile(pipelineRef, storage);
        pipelineFileStore.init(file ?? null);
        autoSave.init(rootSpec, saveName);
      }
    })();

    prevTaskEntityIdsRef.current = new Set(rootSpec.tasks.map((t) => t.$id));

    const disposeTaskWatcher = autorun(() => {
      const currentTaskIds = new Set(rootSpec.tasks.map((t) => t.$id));

      for (const prevId of prevTaskEntityIdsRef.current) {
        if (!currentTaskIds.has(prevId)) {
          windowStore.closeWindowsByLinkedEntity(prevId);
        }
      }

      prevTaskEntityIdsRef.current = currentTaskIds;
    });

    return () => {
      disposeTaskWatcher();
      autoSave.dispose();
      pipelineFileStore.dispose();
      editor.clearSelection();
      navigation.clearNavigation();
      undo.dispose();
      if (isRootStore(rootSpec)) {
        unregisterRootStore(rootSpec);
      }
    };
  }, [
    rootSpec,
    pipelineRef,
    restoredUndoStore,
    editor,
    navigation,
    windowStore,
    undo,
    autoSave,
    pipelineFileStore,
    storage,
  ]);
}
