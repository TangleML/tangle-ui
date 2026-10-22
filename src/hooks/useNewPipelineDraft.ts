import { useBackend } from "@/providers/BackendProvider";
import { APP_ROUTES } from "@/routes/appRoutes";

export function useNewPipelineDraft() {
  const { backendUrl, configured, ready } = useBackend();

  return (name: string) => {
    if (!ready)
      throw new Error("Backend settings are loading. Try again shortly.");
    if (!configured || !backendUrl) {
      throw new Error("Configure a backend in Settings to create pipelines.");
    }
    return {
      to: APP_ROUTES.NEW_PIPELINE,
      state: { newPipeline: { name, draftId: crypto.randomUUID() } },
    };
  };
}
