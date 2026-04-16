import { useNavigate } from "@tanstack/react-router";

import { ActionButton } from "@/components/shared/Buttons/ActionButton";
import { PipelineNameDialog } from "@/components/shared/Dialogs";
import type { ComponentSpec } from "@/models/componentSpec";
import { APP_ROUTES } from "@/routes/router";
import { usePipelineActions } from "@/routes/v2/pages/Editor/store/actions/usePipelineActions";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";

interface RenamePipelineButtonProps {
  spec: ComponentSpec;
}

export const RenamePipelineButton = ({ spec }: RenamePipelineButtonProps) => {
  const { renamePipeline } = usePipelineActions();
  const { pipelineFile: pipelineFileStore } = useEditorSession();
  const navigate = useNavigate();

  const handleSubmit = async (newName: string) => {
    await pipelineFileStore.activePipelineFile?.rename(newName);

    renamePipeline(spec, newName);

    await navigate({
      to: APP_ROUTES.EDITOR_V2_PIPELINE,
      params: { pipelineName: newName },
      search: { fileId: pipelineFileStore.activePipelineFile?.id },
    });
  };

  return (
    <PipelineNameDialog
      trigger={
        <ActionButton icon="Pencil" tooltip="Rename pipeline" onClick={noop} />
      }
      title="Rename Pipeline"
      initialName={spec.name}
      onSubmit={handleSubmit}
      submitButtonText="Rename"
      isSubmitDisabled={(name) => name === spec.name}
    />
  );
};

function noop() {}
