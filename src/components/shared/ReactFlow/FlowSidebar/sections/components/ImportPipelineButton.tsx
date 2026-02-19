import { ActionButton } from "@/components/shared/Buttons/ActionButton";
import ImportPipeline from "@/components/shared/ImportPipeline";

export const ImportPipelineButton = () => {
  return (
    <ImportPipeline
      triggerComponent={
        <ActionButton
          tooltip="Import Pipeline"
          icon="FileUp"
          onClick={() => {}}
        />
      }
    />
  );
};
