import { useState } from "react";

import { replaceTaskComponentRef } from "@/components/shared/ReactFlow/FlowCanvas/utils/replaceTaskComponentRef";
import useToastNotification from "@/hooks/useToastNotification";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import type { HydratedComponentReference } from "@/utils/componentSpec";
import { diffComponentIO } from "@/utils/componentSpecDiff";
import { tracking } from "@/utils/tracking";

import { ActionButton } from "../../Buttons/ActionButton";
import { ComponentEditorDialog } from "../../ComponentEditor/ComponentEditorDialog";
import type { SaveAction } from "../../ComponentEditor/saveAction";
import { SaveActionsView } from "../../ComponentEditor/SaveActionsView";

interface EditComponentButtonProps {
  componentRef: HydratedComponentReference;
  taskId?: string;
}

export const EditComponentButton = ({
  componentRef,
  taskId,
}: EditComponentButtonProps) => {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const notify = useToastNotification();
  const { currentGraphSpec, updateGraphSpec } = useComponentSpec();

  const editedTask = taskId ? currentGraphSpec?.tasks[taskId] : undefined;

  const handleComponentSaved = (
    hydratedComponent: HydratedComponentReference,
    action: SaveAction,
  ) => {
    if (action !== "update") {
      // "place" arrives once placement ships; nothing else applies in place.
      return;
    }

    if (!taskId || !currentGraphSpec?.tasks[taskId]) {
      notify(
        "Could not update the component: the edited task was not found.",
        "error",
      );
      return;
    }

    const { updatedGraphSpec, lostInputs } = replaceTaskComponentRef(
      taskId,
      hydratedComponent,
      currentGraphSpec,
    );

    updateGraphSpec(updatedGraphSpec);

    if (lostInputs.length > 0) {
      const inputNames = lostInputs.map((input) => input.name).join(", ");
      notify(
        `Component updated. Removed ${lostInputs.length} input(s) no longer defined: ${inputNames}.`,
        "warning",
      );
    } else {
      notify("Component updated", "success");
    }
  };

  return (
    <>
      <ActionButton
        tooltip="Edit Component Definition"
        icon="FilePenLine"
        onClick={() => setIsEditDialogOpen(true)}
        {...tracking("pipeline_editor.task_node.edit_component")}
      />
      {isEditDialogOpen && (
        <ComponentEditorDialog
          text={componentRef.text}
          onClose={() => setIsEditDialogOpen(false)}
          onComponentSaved={taskId ? handleComponentSaved : undefined}
          renderSaveActions={
            taskId
              ? ({ hydratedComponent, onChoose }) => {
                  const { inputDiff, outputDiff } = diffComponentIO(
                    editedTask?.componentRef.spec,
                    hydratedComponent.spec,
                  );
                  return (
                    <SaveActionsView
                      taskName={componentRef.name}
                      inputDiff={inputDiff}
                      outputDiff={outputDiff}
                      onChoose={onChoose}
                    />
                  );
                }
              : undefined
          }
        />
      )}
    </>
  );
};
