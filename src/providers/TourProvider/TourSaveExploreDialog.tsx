import { useEffect } from "react";

import { PipelineNameDialog } from "@/components/shared/Dialogs";
import useToastNotification from "@/hooks/useToastNotification";
import { serializeComponentSpecToText } from "@/models/componentSpec";
import { useTourMode } from "@/providers/TourProvider/TourModeContext";
import { useTourSaveExplore } from "@/providers/TourProvider/TourSaveExploreContext";
import { usePipelineActions } from "@/routes/v2/pages/Editor/store/actions/usePipelineActions";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

export function TourSaveExploreDialog() {
  const tourMode = useTourMode();
  const { open, setOpen, setAvailable } = useTourSaveExplore();
  const { navigation } = useSharedStores();
  const { renamePipeline } = usePipelineActions();
  const notify = useToastNotification();

  useEffect(() => {
    if (!tourMode) return undefined;
    setAvailable(true);
    return () => setAvailable(false);
  }, [tourMode, setAvailable]);

  if (!tourMode) return null;

  const onSubmit = async (name: string) => {
    const rootSpec = navigation.rootSpec;
    if (!rootSpec) {
      notify(
        "Pipeline isn't ready to save yet — try again in a moment.",
        "error",
      );
      return;
    }

    try {
      renamePipeline(rootSpec, name);
      const yamlContent = serializeComponentSpecToText(rootSpec);
      await tourMode.promoteToPipeline(name, yamlContent);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save pipeline";
      notify(message, "error");
    }
  };

  return (
    <PipelineNameDialog
      open={open}
      onOpenChange={setOpen}
      title="Save pipeline"
      description="Convert this demo pipeline into a regular pipeline you can keep editing."
      initialName={tourMode.tour.displayName ?? tourMode.tour.id}
      onSubmit={onSubmit}
      submitButtonText="Save"
    />
  );
}
