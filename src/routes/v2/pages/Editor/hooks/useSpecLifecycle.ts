import { autorun, reaction } from "mobx";
import type { UndoStore as MobxUndoStore } from "mobx-keystone";
import { isRootStore, unregisterRootStore } from "mobx-keystone";
import { useEffect, useRef } from "react";

import type { ComponentSpec } from "@/models/componentSpec";
import { serializeComponentSpecToText } from "@/models/componentSpec";
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

    // When the active spec is a nested subgraph, sync its changes back to
    // the root spec whenever it changes. This mutates the root's task
    // componentRef.spec, which the existing autoSave reaction picks up.
    const disposeNestedSync = reaction(
      () => {
        const active = navigation.activeSpec;
        if (!active || active === rootSpec) return null;
        try {
          return serializeComponentSpecToText(active);
        } catch {
          return null;
        }
      },
      () => {
        navigation.syncNestedSpecs();
      },
      { fireImmediately: false },
    );

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
      disposeNestedSync();
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
