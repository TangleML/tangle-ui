import { useNavigate } from "@tanstack/react-router";

import { getDefaultEditorTarget } from "@/routes/editorRoutes";
import { usePipelineActions } from "@/routes/v2/pages/Editor/store/actions/usePipelineActions";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

export function usePipelineRename() {
  const { navigation } = useSharedStores();
  const { autoSave, pipelineFile: pipelineFileStore } = useEditorSession();
  const { renamePipeline } = usePipelineActions();
  const navigate = useNavigate();

  return async (newName: string) => {
    const spec = navigation.rootSpec;
    if (!spec) return;
    await pipelineFileStore.activePipelineFile?.rename(newName);
    renamePipeline(spec, newName);
    await autoSave.save();
    await navigate(
      getDefaultEditorTarget({
        name: newName,
        fileId: pipelineFileStore.activePipelineFile?.id,
      }),
    );
  };
}
