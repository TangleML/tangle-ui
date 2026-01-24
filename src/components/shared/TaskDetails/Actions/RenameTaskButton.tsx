import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { RenameDialog } from "@/components/shared/Dialogs/RenameDialog";
import { Icon } from "@/components/ui/icon";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import type { MetadataSpec } from "@/utils/componentSpec";
import { getComponentName } from "@/utils/getComponentName";

interface RenameTaskButtonProps {
  taskId: string;
}

export const RenameTaskButton = ({ taskId }: RenameTaskButtonProps) => {
  const { currentGraphSpec, updateGraphSpec } = useComponentSpec();

  const taskSpec = currentGraphSpec?.tasks[taskId];
  const componentRef = taskSpec?.componentRef;

  const name = getComponentName(componentRef);

  const currentDisplayName =
    (currentGraphSpec?.tasks[taskId]?.annotations?.[
      "display_name"
    ] as string) ?? "";

  const isSubmitDisabled = (name: string) => {
    return name === currentDisplayName;
  };

  const handleTitleUpdate = async (name: string) => {
    if (!currentGraphSpec) {
      console.error("Cannot rename task: currentGraphSpec is undefined");
      return;
    }

    const annotations = taskSpec?.annotations || {};
    let updatedAnnotations: MetadataSpec["annotations"];

    if (name.trim() === "") {
      const { ["display_name"]: _, ...rest } = annotations;
      updatedAnnotations = rest;
    } else {
      updatedAnnotations = {
        ...annotations,
        display_name: name,
      };
    }

    const updatedTaskSpec = {
      ...taskSpec,
      annotations: updatedAnnotations,
    };

    const updatedGraphSpec = {
      ...currentGraphSpec,
      tasks: {
        ...currentGraphSpec.tasks,
        [taskId]: updatedTaskSpec,
      },
    };

    updateGraphSpec(updatedGraphSpec);
  };

  const handleValidation = (value: string) => {
    const warnings: string[] = [];
    const errors: string[] = [];

    if (value.trim().length === 0 && value !== currentDisplayName) {
      warnings.push(
        `Display name is empty. Default name "${name}" will be used.`,
      );
    }

    if (value.length > 100) {
      errors.push(
        "Display name is too long. Maximum length is 100 characters.",
      );
    }

    return { warnings, errors };
  };

  return (
    <RenameDialog
      trigger={
        <TooltipButton variant="outline" tooltip="Rename Task">
          <Icon name="PencilLine" />
        </TooltipButton>
      }
      title="Rename Task"
      description={`Change the display name of the task "${taskId}".`}
      placeholder={name}
      initialName={currentDisplayName ?? ""}
      onSubmit={handleTitleUpdate}
      submitButtonText="Update Name"
      isSubmitDisabled={isSubmitDisabled}
      validate={handleValidation}
    />
  );
};
