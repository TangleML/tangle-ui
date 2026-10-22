import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { reaction } from "mobx";
import { useEffect } from "react";

import { APP_ROUTES } from "@/routes/appRoutes";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { promoteRemoteDraftQuery } from "@/routes/v2/pages/Editor/utils/promoteRemoteDraftQuery";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import {
  type EditorPipelineRef,
  isRemotePipelineDraftRef,
} from "@/services/pipelineStorage/types";

export function useRemoteDraftPromotion(
  ref: EditorPipelineRef,
  file: PipelineFile,
) {
  const { autoSave } = useEditorSession();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const draft = isRemotePipelineDraftRef(ref) ? ref : undefined;

  useEffect(() => {
    if (!draft) return;
    return reaction(
      () =>
        file.remote &&
        !autoSave.isSaving &&
        !autoSave.error &&
        !autoSave.hasUnsavedChanges
          ? file.remote
          : undefined,
      (remote) => {
        if (!remote) return;
        // Keep the same document and lifecycle inputs across the URL change.
        // The mounted editor session already holds the complete undo/redo state.
        promoteRemoteDraftQuery(queryClient, draft, {
          source: "remote",
          ...remote,
        });
        void navigate({
          to: APP_ROUTES.REMOTE_PIPELINE_EDITOR,
          params: { pipelineId: remote.pipelineId },
          replace: true,
          resetScroll: false,
        });
      },
      { fireImmediately: true },
    );
  }, [draft, autoSave, file, queryClient, navigate]);
}
