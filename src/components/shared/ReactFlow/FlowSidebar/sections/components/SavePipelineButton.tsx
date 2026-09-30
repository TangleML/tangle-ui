import { useCallback } from "react";

import { ActionButton } from "@/components/shared/Buttons/ActionButton";
import useToastNotification from "@/hooks/useToastNotification";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { useSavePipeline } from "@/services/pipelineService";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import { tracking } from "@/utils/tracking";

interface SavePipelineButtonProps {
  onSaveComplete?: () => void;
}

export const SavePipelineButton = ({
  onSaveComplete,
}: SavePipelineButtonProps) => {
  const { componentSpec } = useComponentSpec();
  const storage = usePipelineStorage();
  const { savePipeline } = useSavePipeline(componentSpec, storage);
  const notify = useToastNotification();

  const handleSavePipeline = useCallback(async () => {
    await savePipeline();
    notify(
      `Pipeline saved as "${componentSpec?.name ?? "Untitled Pipeline"}"`,
      "success",
    );
    onSaveComplete?.();
  }, [savePipeline, notify, componentSpec?.name, onSaveComplete]);

  return (
    <ActionButton
      tooltip="Save Pipeline"
      icon="Save"
      onClick={handleSavePipeline}
      {...tracking("pipeline_editor.pipeline_actions.save_pipeline")}
    />
  );
};
