import { useState } from "react";

import type { HydratedComponentReference } from "@/utils/componentSpec";

import { ActionButton } from "../../Buttons/ActionButton";
import { ComponentEditorDialog } from "../../ComponentEditor/ComponentEditorDialog";

interface EditComponentButtonProps {
  componentRef: HydratedComponentReference;
}

export const EditComponentButton = ({
  componentRef,
}: EditComponentButtonProps) => {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const handleClick = () => {
    setIsEditDialogOpen(true);
  };

  const handleClose = () => {
    setIsEditDialogOpen(false);
  };

  return (
    <>
      <ActionButton
        tooltip="Edit Component Definition"
        icon="FilePenLine"
        onClick={handleClick}
      />
      {isEditDialogOpen && (
        <ComponentEditorDialog text={componentRef.text} onClose={handleClose} />
      )}
    </>
  );
};
