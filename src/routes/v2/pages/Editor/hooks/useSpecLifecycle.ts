import { autorun, reaction, untracked } from "mobx";
import type { UndoStore as MobxUndoStore } from "mobx-keystone";
import { isRootStore, unregisterRootStore } from "mobx-keystone";
import { useEffect, useRef } from "react";

import type { ComponentSpec } from "@/models/componentSpec";
import { collectIdStack } from "@/models/componentSpec";
import { useCollabRoom } from "@/routes/v2/pages/Editor/hooks/useCollabRoom";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { saveIdStack } from "@/routes/v2/pages/Editor/utils/undoHistoryStorage";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { getCollabServerUrl } from "@/services/collaboration/collabServerUrl";
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
    collaboration,
    pipelineFile: pipelineFileStore,
  } = useEditorSession();
  const storage = usePipelineStorage();
  const prevTaskEntityIdsRef = useRef<Set<string>>(new Set());

  const {
    room: collabRoom,
    active: collabActive,
    seedFromClient: collabSeedFromClient,
  } = useCollabRoom();

  useEffect(() => {
    if (!rootSpec) return;

    editor.resetState();
    navigation.initNavigation(rootSpec);

    if (collabActive && collabRoom) {
      // Collab mode owns the shared document: undo (which would itself have to
      // become a command) and autosave (which would fork the local file) are
      // both off; the room, not disk, is the source of truth.
      collaboration.init(rootSpec, collabRoom, getCollabServerUrl(), {
        seedFromClient: collabSeedFromClient,
      });
    } else {
      undo.init(rootSpec, restoredUndoStore);

      const saveName = pipelineRef.name ?? rootSpec.name;

      void (async () => {
        if (saveName) {
          const file = await resolvePipelineFile(pipelineRef, storage);
          pipelineFileStore.init(file ?? null);
          autoSave.init(rootSpec, saveName);
          // Persist the id ordering up front so a reload replays the same `$id`s
          // even if the user never edits — keeps chat entity links resolvable.
          await saveIdStack(saveName, collectIdStack(rootSpec)).catch((error) =>
            console.warn("Failed to persist pipeline id stack", error),
          );
        }
      })();
    }

    prevTaskEntityIdsRef.current = new Set(rootSpec.tasks.map((t) => t.$id));

    const disposeTaskWatcher = autorun(() => {
      const currentTaskIds = new Set(rootSpec.tasks.map((t) => t.$id));

      for (const prevId of prevTaskEntityIdsRef.current) {
        if (!currentTaskIds.has(prevId)) {
          windowStore.closeWindowsByLinkedEntity(prevId);
          // A remote delete can retire a task the local user has selected;
          // drop the stale selection so the context panel does not linger.
          untracked(() => {
            if (editor.selectedNodeId === prevId) editor.clearSelection();
            if (editor.multiSelection.some((n) => n.id === prevId)) {
              editor.setMultiSelection(
                editor.multiSelection.filter((n) => n.id !== prevId),
              );
            }
          });
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
      collaboration.dispose();
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
    collaboration,
    collabActive,
    collabRoom,
    collabSeedFromClient,
    pipelineFileStore,
    storage,
  ]);
}
