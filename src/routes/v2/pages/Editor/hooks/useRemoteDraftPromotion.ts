import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { reaction } from "mobx";
import { useEffect } from "react";

import type { ComponentSpec } from "@/models/componentSpec";
import { APP_ROUTES } from "@/routes/appRoutes";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import {
  type EditorPipelineRef,
  getEditorPipelineIdentity,
  isRemotePipelineDraftRef,
} from "@/services/pipelineStorage/types";

import { EDITOR_SPEC_QUERY_KEY } from "./useLoadSpec";

export function useRemoteDraftPromotion(
  ref: EditorPipelineRef,
  spec: ComponentSpec,
  file: PipelineFile,
) {
  const { autoSave } = useEditorSession();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const draft = isRemotePipelineDraftRef(ref);

  useEffect(() => {
    if (!draft) return;
    return reaction(
      () =>
        file.remote &&
        autoSave.lastSavedAt &&
        !autoSave.isSaving &&
        !autoSave.error &&
        !autoSave.hasUnsavedChanges
          ? file.remote
          : undefined,
      (remote) => {
        if (!remote) return;
        // Keep the same document and lifecycle inputs across the URL change.
        // The mounted editor session already holds the complete undo/redo state.
        queryClient.setQueryData(
          [
            EDITOR_SPEC_QUERY_KEY,
            getEditorPipelineIdentity({ source: "remote", ...remote }),
          ],
          { spec, file },
        );
        void navigate({
          to: APP_ROUTES.EDITOR_V2_REMOTE_PIPELINE,
          params: { pipelineId: remote.pipelineId },
          replace: true,
          resetScroll: false,
        });
      },
      { fireImmediately: true },
    );
  }, [draft, autoSave, spec, file, queryClient, navigate]);
}
