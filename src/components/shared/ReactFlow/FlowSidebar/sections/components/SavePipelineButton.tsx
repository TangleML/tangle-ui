import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

import { ActionButton } from "@/components/shared/Buttons/ActionButton";
import useToastNotification from "@/hooks/useToastNotification";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { useSavePipeline } from "@/services/pipelineService";
import { tracking } from "@/utils/tracking";

interface SavePipelineButtonProps {
  onSaveComplete?: () => void;
}

export const SavePipelineButton = ({
  onSaveComplete,
}: SavePipelineButtonProps) => {
  const { componentSpec } = useComponentSpec();
  const { savePipeline } = useSavePipeline(componentSpec);
  const notify = useToastNotification();
  const navigate = useNavigate();

  const handleSavePipeline = useCallback(async () => {
    const saved = await savePipeline();
    notify(
      `Pipeline saved as "${componentSpec?.name ?? "Untitled Pipeline"}"`,
      "success",
    );
    onSaveComplete?.();
    if (saved?.remote) await navigate({ to: saved.url });
  }, [savePipeline, notify, componentSpec?.name, onSaveComplete, navigate]);

  return (
    <ActionButton
      tooltip="Save Pipeline"
      icon="Save"
      onClick={handleSavePipeline}
      {...tracking("pipeline_editor.pipeline_actions.save_pipeline")}
    />
  );
};
