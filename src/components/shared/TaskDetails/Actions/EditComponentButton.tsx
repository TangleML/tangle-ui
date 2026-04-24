import { useState } from "react";

import type { HydratedComponentReference } from "@/utils/componentSpec";
import { tracking } from "@/utils/tracking";

import { ActionButton } from "../../Buttons/ActionButton";
import { ComponentEditorDialog } from "../../ComponentEditor/ComponentEditorDialog";

interface EditComponentButtonProps {
  componentRef: HydratedComponentReference;
}

export const EditComponentButton = ({
  componentRef,
}: EditComponentButtonProps) => {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

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
        />
      )}
    </>
  );
};
