import useToastNotification from "@/hooks/useToastNotification";
import { usePipelineActions } from "@/routes/v2/pages/Editor/store/actions/usePipelineActions";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

export function usePipelineRename() {
  const { navigation } = useSharedStores();
  const { autoSave } = useEditorSession();
  const { renamePipeline } = usePipelineActions();
  const notify = useToastNotification();

  return async (newName: string) => {
    const spec = navigation.rootSpec;
    if (!spec) return;
    try {
      renamePipeline(spec, newName);
      await autoSave.save();
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Failed to rename pipeline",
        "error",
      );
    }
  };
}
