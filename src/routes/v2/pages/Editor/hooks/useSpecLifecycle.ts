import { autorun, reaction } from "mobx";
import {
  isRootStore,
  registerRootStore,
  type UndoManager,
  unregisterRootStore,
} from "mobx-keystone";
import { useEffect, useRef } from "react";

import type { ComponentSpec } from "@/models/componentSpec";
import type { DocumentSaveState } from "@/routes/v2/pages/Editor/store/documentSaveState";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";

export function useSpecLifecycle(
  rootSpec: ComponentSpec,
  file?: PipelineFile,
  saveState?: DocumentSaveState,
  undoManager?: UndoManager,
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
    undo.init(rootSpec, undoManager);

    if (file) {
      pipelineFileStore.init(file);
      if (saveState) autoSave.init(saveState);
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
        depth: navigation.navigationDepth,
      }),
      ({ active, depth }) => {
        if (!active && depth > 0) {
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
      if (!file && isRootStore(rootSpec)) unregisterRootStore(rootSpec);
    };
  }, [
    rootSpec,
    file,
    saveState,
    undoManager,
    editor,
    navigation,
    windowStore,
    undo,
    autoSave,
    pipelineFileStore,
  ]);
}
