import { ActionButton } from "@/components/shared/Buttons/ActionButton";
import { PipelineNameDialog } from "@/components/shared/Dialogs";
import type { ComponentSpec } from "@/models/componentSpec";

import { renamePipeline } from "../store/actions";

interface RenamePipelineButtonProps {
  spec: ComponentSpec;
}

export const RenamePipelineButton = ({ spec }: RenamePipelineButtonProps) => {
  const handleSubmit = (name: string) => {
    renamePipeline(spec, name);
  };

  return (
    <PipelineNameDialog
      trigger={
        <ActionButton
          icon="Pencil"
          tooltip="Rename pipeline"
          onClick={() => {}}
        />
      }
      title="Rename Pipeline"
      initialName={spec.name}
      onSubmit={handleSubmit}
      submitButtonText="Rename"
      isSubmitDisabled={(name) => name === spec.name}
    />
  );
};
