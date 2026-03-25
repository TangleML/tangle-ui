import { useLocation, useNavigate } from "@tanstack/react-router";

import { ActionButton } from "@/components/shared/Buttons/ActionButton";
import { PipelineNameDialog } from "@/components/shared/Dialogs";
import type { ComponentSpec } from "@/models/componentSpec";
import { serializeComponentSpecToYaml } from "@/models/componentSpec";
import { APP_ROUTES } from "@/routes/router";
import { usePipelineActions } from "@/routes/v2/pages/Editor/store/actions/usePipelineActions";
import {
  renameComponentFileInList,
  writeComponentToFileListFromText,
} from "@/utils/componentStore";
import { USER_PIPELINES_LIST_NAME } from "@/utils/constants";

interface RenamePipelineButtonProps {
  spec: ComponentSpec;
}

export const RenamePipelineButton = ({ spec }: RenamePipelineButtonProps) => {
  const { renamePipeline } = usePipelineActions();
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;
  const title = spec.name;

  const handleSubmit = async (newName: string) => {
    console.log("handleSubmit", newName);
    await renameComponentFileInList(
      USER_PIPELINES_LIST_NAME,
      title ?? "",
      newName,
      pathname,
    );

    renamePipeline(spec, newName);

    await writeComponentToFileListFromText(
      USER_PIPELINES_LIST_NAME,
      newName,
      serializeComponentSpecToYaml(spec),
    );

    await navigate({
      to: APP_ROUTES.EDITOR_V2_PIPELINE,
      params: { pipelineName: newName },
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
