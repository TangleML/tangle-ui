import { useEffect, useState } from "react";

import { PipelineNameDialog } from "@/components/shared/Dialogs";
import { serializeComponentSpecToText } from "@/models/componentSpec";
import { useTourMode } from "@/providers/TourProvider/TourModeContext";
import { registerSaveExploreHandler } from "@/providers/TourProvider/TourPopover";
import { usePipelineActions } from "@/routes/v2/pages/Editor/store/actions/usePipelineActions";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

export function TourSaveExploreDialog() {
  const tourMode = useTourMode();
  const { navigation } = useSharedStores();
  const { renamePipeline } = usePipelineActions();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!tourMode) return;
    return registerSaveExploreHandler(() => setOpen(true));
  }, [tourMode]);

  if (!tourMode) return null;

  const onSubmit = async (name: string) => {
    const rootSpec = navigation.rootSpec;
    if (!rootSpec) return;

    renamePipeline(rootSpec, name);
    const yamlContent = serializeComponentSpecToText(rootSpec);
    await tourMode.promoteToPipeline(name, yamlContent);
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
