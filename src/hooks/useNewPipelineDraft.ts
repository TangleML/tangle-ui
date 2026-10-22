import { useBackend } from "@/providers/BackendProvider";
import { APP_ROUTES } from "@/routes/appRoutes";
import { createsLocalPipelines } from "@/services/pipelineStorage/pipelineCreation";

export function useNewPipelineDraft() {
  const { backendUrl, configured, ready } = useBackend();

  return (name: string) => {
    if (createsLocalPipelines()) return undefined;
    if (!ready || !configured || !backendUrl) {
      throw new Error("Configure a backend in Settings to create pipelines.");
    }
    return {
      to: APP_ROUTES.EDITOR_NEW_PIPELINE,
      state: { newPipeline: { name, draftId: crypto.randomUUID() } },
    };
  };
}
