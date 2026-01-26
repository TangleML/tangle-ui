import { useLocation, useNavigate } from "@tanstack/react-router";

import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { RenameDialog } from "@/components/shared/Dialogs/RenameDialog";
import { Icon } from "@/components/ui/icon";
import useLoadUserPipelines from "@/hooks/useLoadUserPipelines";
import useToastNotification from "@/hooks/useToastNotification";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { APP_ROUTES } from "@/routes/router";
import { renameComponentFileInList } from "@/utils/componentStore";
import { USER_PIPELINES_LIST_NAME } from "@/utils/constants";

const RenamePipeline = () => {
  const { componentSpec, saveComponentSpec } = useComponentSpec();
  const notify = useToastNotification();
  const navigate = useNavigate();
  const { userPipelines, refetch: refetchUserPipelines } =
    useLoadUserPipelines();

  const location = useLocation();
  const pathname = location.pathname;

  const title = componentSpec?.name;

  const isSubmitDisabled = (name: string) => {
    return name === title;
  };

  const handleTitleUpdate = async (name: string) => {
    if (!componentSpec) {
      notify("Update failed: ComponentSpec not found", "error");
      return;
    }

    await renameComponentFileInList(
      USER_PIPELINES_LIST_NAME,
      title ?? "",
      name,
      pathname,
    );

    await saveComponentSpec(name);

    const urlName = encodeURIComponent(name);
    const url = APP_ROUTES.PIPELINE_EDITOR.replace("$name", urlName);

    navigate({ to: url });
  };

  const handleValidation = (value: string) => {
    const warnings: string[] = [];
    const errors: string[] = [];

    const existingPipelineNames = new Set(
      Array.from(userPipelines.keys()).map((name) => name.toLowerCase()),
    );

    const normalizedValue = value.trim().toLowerCase();

    if (normalizedValue === "") {
      errors.push("Name cannot be empty");
    } else if (existingPipelineNames.has(normalizedValue)) {
      errors.push("Name already exists");
    }

    return { warnings, errors };
  };

  const handleOpenChange = (open: boolean) => {
    if (open) {
      refetchUserPipelines();
    }
  };

  return (
    <RenameDialog
      trigger={
        <TooltipButton variant="outline" tooltip="Rename pipeline">
          <Icon name="PencilLine" />
        </TooltipButton>
      }
      title="Name Pipeline"
      description="Unsaved pipeline changes will be lost."
      initialName={title ?? ""}
      onSubmit={handleTitleUpdate}
      submitButtonText="Update Title"
      isSubmitDisabled={isSubmitDisabled}
      validate={handleValidation}
      onOpenChange={handleOpenChange}
    />
  );
};

export default RenamePipeline;
