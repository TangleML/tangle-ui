import { autorun, reaction } from "mobx";
import type { UndoStore as MobxUndoStore } from "mobx-keystone";
import {
  isRootStore,
  readonlyMiddleware,
  unregisterRootStore,
} from "mobx-keystone";
import { useEffect, useRef } from "react";

import type { ComponentSpec } from "@/models/componentSpec";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
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

    editor.resetState();
    navigation.initNavigation(rootSpec);
    pipelineFileStore.init(file);
    if (file.canEdit) {
      undo.init(rootSpec, restoredUndoStore);
      autoSave.init(rootSpec);
    }
    const readOnly = file.canEdit ? undefined : readonlyMiddleware(rootSpec);

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
      readOnly?.dispose();
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
