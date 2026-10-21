import type { QueryClient } from "@tanstack/react-query";
import { runInAction } from "mobx";

import type { DocumentSaveState } from "@/routes/v2/pages/Editor/store/documentSaveState";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import {
  remotePipelineDeletionError,
  RemotePipelineDeletionUncertainError,
} from "@/services/pipelineStorage/remotePipelineDeletion";
import type { RemotePipelineRef } from "@/services/pipelineStorage/types";

export const EDITOR_SPEC_QUERY_KEY = "editor-v2-spec";

interface CachedEditorDocument {
  file: PipelineFile;
  saveState: DocumentSaveState;
}

export async function reconcileDeletedRemotePipeline(
  queryClient: QueryClient,
  ref: RemotePipelineRef,
  error = remotePipelineDeletionError(),
): Promise<void> {
  const documents = queryClient.getQueriesData<CachedEditorDocument>({
    queryKey: [EDITOR_SPEC_QUERY_KEY],
  });
  await Promise.all(
    documents.map(async ([queryKey, document]) => {
      const remote = document?.file.remote;
      if (
        !document ||
        remote?.backendUrl !== ref.backendUrl ||
        remote.pipelineId !== ref.pipelineId
      )
        return;
      // A completed server write can still be finishing the saving indicator.
      // Let it settle before deciding whether this editor has recoverable edits.
      await document.saveState.pendingSave?.promise.catch(() => {});
      if (queryClient.getQueryData(queryKey) !== document) return;
      if (error instanceof RemotePipelineDeletionUncertainError) {
        runInAction(() => {
          document.saveState.lastSavedYaml = null;
        });
      }
      if (document.saveState.hasUnsavedChanges) {
        document.saveState.recordError(error);
        return;
      }
      const query = queryClient.getQueryCache().find({ queryKey, exact: true });
      if (query?.getObserversCount()) {
        await queryClient.resetQueries({ queryKey, exact: true });
      } else {
        queryClient.removeQueries({ queryKey, exact: true });
      }
    }),
  );
}
