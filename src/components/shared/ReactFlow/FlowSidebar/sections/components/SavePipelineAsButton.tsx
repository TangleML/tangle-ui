import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

import { ActionButton } from "@/components/shared/Buttons/ActionButton";
import { PipelineNameDialog } from "@/components/shared/Dialogs";
import useToastNotification from "@/hooks/useToastNotification";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { EDITOR_PATH } from "@/routes/router";
import { useSavePipeline } from "@/services/pipelineService";

interface SavePipelineAsButtonProps {
  onSaveComplete?: (name: string) => void;
}

export const SavePipelineAsButton = ({
  onSaveComplete,
}: SavePipelineAsButtonProps) => {
  const { componentSpec } = useComponentSpec();
  const { savePipeline } = useSavePipeline(componentSpec);
  const notify = useToastNotification();
  const navigate = useNavigate();

  const getDuplicatePipelineName = useCallback(() => {
    return componentSpec?.name
      ? `${componentSpec.name} (Copy)`
      : `Untitled Pipeline ${new Date().toLocaleTimeString()}`;
  }, [componentSpec?.name]);

  const handleSavePipelineAs = useCallback(
    async (name: string) => {
      await savePipeline(name);
      notify(`Pipeline saved as "${name}"`, "success");
      onSaveComplete?.(name);

      navigate({
        to: `${EDITOR_PATH}/${encodeURIComponent(name)}`,
      });
    },
    [navigate, savePipeline, notify, onSaveComplete],
  );

  return (
    <PipelineNameDialog
      trigger={
        <ActionButton
          tooltip="Save Pipeline As"
          icon="SaveAll"
          onClick={() => {}}
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
