import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

import { ActionButton } from "@/components/shared/Buttons/ActionButton";
import { PipelineNameDialog } from "@/components/shared/Dialogs";
import useToastNotification from "@/hooks/useToastNotification";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { EDITOR_PATH } from "@/routes/router";
import { useSavePipeline } from "@/services/pipelineService";
import { tracking } from "@/utils/tracking";

interface SavePipelineAsButtonProps {
  onSaveComplete?: (name: string) => void;
}

export const SavePipelineAsButton = ({
  onSaveComplete,
}: SavePipelineAsButtonProps) => {
  const { componentSpec } = useComponentSpec();
  const { savePipeline } = useSavePipeline(componentSpec);
  const notify = useToastNotification();
  const { track } = useAnalytics();
  const navigate = useNavigate();

  const getDuplicatePipelineName = useCallback(() => {
    return componentSpec?.name
      ? `${componentSpec.name} (Copy)`
      : `Untitled Pipeline ${new Date().toLocaleTimeString()}`;
  }, [componentSpec?.name]);

  const handleSavePipelineAs = useCallback(
    async (name: string) => {
      await savePipeline(name);
      track("pipeline_editor.pipeline_actions.save_pipeline_as_completed");
      notify(`Pipeline saved as "${name}"`, "success");
      onSaveComplete?.(name);

      navigate({
        to: `${EDITOR_PATH}/${encodeURIComponent(name)}`,
      });
    },
    [navigate, savePipeline, notify, onSaveComplete, track],
  );

  return (
    <PipelineNameDialog
      trigger={
        <ActionButton
          tooltip="Save Pipeline As"
          icon="SaveAll"
          onClick={() => {}}
          {...tracking("pipeline_editor.pipeline_actions.save_pipeline_as")}
        />
      }
      title="Save Pipeline As"
      description="Enter a name for your pipeline"
      initialName={getDuplicatePipelineName()}
      onSubmit={handleSavePipelineAs}
      submitButtonText="Save"
    />
  );
};
