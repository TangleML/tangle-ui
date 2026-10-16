import { autorun, reaction } from "mobx";
import type { UndoStore as MobxUndoStore } from "mobx-keystone";
import {
  isRootStore,
  registerRootStore,
  unregisterRootStore,
} from "mobx-keystone";
import { useEffect, useRef } from "react";

import type { ComponentSpec } from "@/models/componentSpec";
import { collectIdStack } from "@/models/componentSpec";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { saveIdStack } from "@/routes/v2/pages/Editor/utils/undoHistoryStorage";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";

export function useSpecLifecycle(
  rootSpec: ComponentSpec,
  file: PipelineFile,
  restoredUndoStore?: MobxUndoStore,
) {
  const { editor, navigation, windows: windowStore } = useSharedStores();
  const {
    undo,
    autoSave,
    pipelineFile: pipelineFileStore,
  } = useEditorSession();
  const prevTaskEntityIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!rootSpec) return;

    autoSave.dispose();
    if (!isRootStore(rootSpec)) registerRootStore(rootSpec);
    editor.resetState();
    navigation.initNavigation(rootSpec);
    if (file.remote) undo.dispose();
    else undo.init(rootSpec, restoredUndoStore);

    pipelineFileStore.init(file);
    autoSave.init(rootSpec, file);
    if (!file.remote) {
      void saveIdStack(file.storageKey, collectIdStack(rootSpec)).catch(
        (error) => console.warn("Failed to persist pipeline id stack", error),
      );
    }

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

    const disposeNavGuard = reaction(
      () => ({
        active: navigation.activeSpec,
        depth: navigation.navigationPath.length,
      }),
      ({ active, depth }) => {
        if (!active && depth > 1) {
          navigation.correctInvalidNavigation();
        }
      },
    );

    return () => {
      disposeTaskWatcher();
      disposeNavGuard();
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
    file,
    restoredUndoStore,
    editor,
    navigation,
    windowStore,
    undo,
    autoSave,
    pipelineFileStore,
  ]);
}
