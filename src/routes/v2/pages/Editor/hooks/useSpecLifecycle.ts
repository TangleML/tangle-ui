import { autorun } from "mobx";
import type { UndoStore as MobxUndoStore } from "mobx-keystone";
import { isRootStore, unregisterRootStore } from "mobx-keystone";
import { useEffect, useRef } from "react";

import type { ComponentSpec } from "@/models/componentSpec";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { closeWindowsByLinkedEntity } from "@/routes/v2/shared/windows/windows.actions";

export function useSpecLifecycle(
  rootSpec: ComponentSpec,
  pipelineName: string | null,
  restoredUndoStore?: MobxUndoStore,
) {
  const { editor, navigation } = useSharedStores();
  const { undo, autoSave } = useEditorSession();
  const prevTaskEntityIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (rootSpec) {
      editor.resetState();
      navigation.initNavigation(rootSpec);
      undo.init(rootSpec, restoredUndoStore);

      const saveName = pipelineName ?? rootSpec.name;
      if (saveName) {
        autoSave.init(rootSpec, saveName);
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
        autoSave.dispose();
        editor.clearSelection();
        navigation.clearNavigation();
        undo.dispose();
        if (isRootStore(rootSpec)) {
          unregisterRootStore(rootSpec);
        }
      };
    }
  }, [
    rootSpec,
    pipelineName,
    restoredUndoStore,
    editor,
    navigation,
    undo,
    autoSave,
  ]);
}
