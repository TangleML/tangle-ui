import { useNavigate } from "@tanstack/react-router";
import { reaction } from "mobx";
import { useEffect } from "react";

import { APP_ROUTES } from "@/routes/appRoutes";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import {
  type EditorPipelineRef,
  isRemotePipelineDraftRef,
} from "@/services/pipelineStorage/types";

export function useRemoteDraftPromotion(
  ref: EditorPipelineRef | undefined,
  file: PipelineFile | undefined,
) {
  const { autoSave } = useEditorSession();
  const { navigation } = useSharedStores();
  const navigate = useNavigate();
  const draft = ref && isRemotePipelineDraftRef(ref) ? ref : undefined;

  useEffect(() => {
    if (!draft || !file) return;
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
        void navigate({
          to: APP_ROUTES.REMOTE_PIPELINE_EDITOR,
          params: { pipelineId: remote.pipelineId },
          search: (previous) => ({
            ...previous,
            subgraphPath: navigation.canNavigateBack
              ? navigation.navigationPath
                  .slice(1)
                  .map((entry) => entry.displayName)
              : undefined,
          }),
          replace: true,
          resetScroll: false,
        });
      },
      { fireImmediately: true },
    );
  }, [draft, autoSave, file, navigate, navigation]);
}
