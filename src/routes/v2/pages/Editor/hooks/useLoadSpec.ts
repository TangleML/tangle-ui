import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { autorun } from "mobx";
import { use, useEffect, useSyncExternalStore } from "react";

import { addRecentlyViewed } from "@/hooks/useRecentlyViewed";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import { getRemotePipelineDeletionError } from "@/services/pipelineStorage/remotePipelineDeletion";
import type { EditorPipelineRef } from "@/services/pipelineStorage/types";

export type { LoadedSpec } from "@/services/pipelineStorage/PipelineStorageService";

export function useLoadSpec(ref: EditorPipelineRef) {
  const storage = usePipelineStorage();
  const resetBoundary = useQueryErrorResetBoundary();
  if (resetBoundary.isReset()) {
    resetBoundary.clearReset();
    storage.retryDocument(ref);
  }
  const loading = useSyncExternalStore(storage.subscribe, () =>
    storage.loadDocument(ref),
  );
  const document = use(loading);
  useEffect(
    () =>
      autorun(() => {
        const remote = document.file.remote;
        if (
          !remote ||
          getRemotePipelineDeletionError({ source: "remote", ...remote })
        )
          return;
        addRecentlyViewed(
          {
            type: "pipeline",
            id: remote.pipelineId,
            name: document.spec.name ?? "Untitled pipeline",
          },
          remote.backendUrl,
        );
      }),
    [document],
  );
  return { data: document };
}
