import { ActionButton } from "@/components/shared/Buttons/ActionButton";
import ImportPipeline from "@/components/shared/ImportPipeline";
import { tracking } from "@/utils/tracking";

export const ImportPipelineButton = () => {
  return (
    <ImportPipeline
      triggerComponent={
        <ActionButton
          tooltip="Import Pipeline"
          icon="FileUp"
          onClick={() => {}}
          {...tracking("pipeline_editor.pipeline_actions.import_pipeline")}
        />
      }
    />
  );
};
