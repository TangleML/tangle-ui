import { useNavigate } from "@tanstack/react-router";

import useToastNotification from "@/hooks/useToastNotification";
import { getEditorLocation } from "@/routes/editorRoutes";
import { usePipelineActions } from "@/routes/v2/pages/Editor/store/actions/usePipelineActions";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

export function usePipelineRename() {
  const { navigation } = useSharedStores();
  const { autoSave, pipelineFile: pipelineFileStore } = useEditorSession();
  const { renamePipeline } = usePipelineActions();
  const navigate = useNavigate();
  const notify = useToastNotification();

  return async (newName: string) => {
    const spec = navigation.rootSpec;
    const file = pipelineFileStore.activePipelineFile;
    if (!spec || !file?.canEdit) return;
    try {
      if (file.storageKind === "local") await file.rename(newName);
      renamePipeline(spec, newName);
      await autoSave.save();
      if (file.storageKind === "local") await navigate(getEditorLocation(file));
    } catch (error) {
      notify(`Could not rename pipeline: ${error}`, "error");
    }
  };
}
