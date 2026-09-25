import { autorun, reaction } from "mobx";
import type { UndoStore as MobxUndoStore } from "mobx-keystone";
import { isRootStore, unregisterRootStore } from "mobx-keystone";
import { useEffect, useRef } from "react";

import type { ComponentSpec } from "@/models/componentSpec";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import type { PipelineRef } from "@/services/pipelineStorage/types";

export function useSpecLifecycle(
  rootSpec: ComponentSpec,
  pipelineRef: PipelineRef,
  pipelineFile: PipelineFile,
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
    undo.init(rootSpec, restoredUndoStore);

    const saveName = pipelineRef.name ?? rootSpec.name;

    if (saveName) {
      pipelineFileStore.init(pipelineFile);
      autoSave.init(rootSpec, saveName);
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
    pipelineRef,
    pipelineFile,
    restoredUndoStore,
    editor,
    navigation,
    windowStore,
    undo,
    autoSave,
    pipelineFileStore,
  ]);
}
