import { useState } from "react";

import { ActionButton } from "@/components/shared/Buttons/ActionButton";
import { ComponentEditorDialog } from "@/components/shared/ComponentEditor/ComponentEditorDialog";

interface EditComponentButtonProps {
  yamlText: string;
}

export const EditComponentButton = ({
  yamlText,
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
        <ComponentEditorDialog text={yamlText} onClose={handleClose} />
      )}
    </>
  );
};
