import { useFlagValue } from "@/components/shared/Settings/useFlags";
import { useBackend } from "@/providers/BackendProvider";
import { APP_ROUTES } from "@/routes/appRoutes";
import { createsLocalPipelines } from "@/services/pipelineStorage/pipelineCreation";

export function useNewPipelineDraft() {
  const v2Enabled = useFlagValue("v2_editor");
  const { backendUrl, configured, ready } = useBackend();

  return (name: string) => {
    if (createsLocalPipelines()) return undefined;
    if (!v2Enabled) {
      throw new Error("Enable the V2 editor to create pipelines.");
    }
    if (!ready || !configured || !backendUrl) {
      throw new Error("Configure a backend in Settings to create pipelines.");
    }
    return {
      to: APP_ROUTES.EDITOR_V2_NEW_PIPELINE,
      state: { newPipeline: { name, draftId: crypto.randomUUID() } },
    };
  };
}
