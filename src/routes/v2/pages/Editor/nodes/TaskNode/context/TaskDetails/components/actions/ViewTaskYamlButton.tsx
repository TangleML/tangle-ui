import { useState } from "react";

import { ActionButton } from "@/components/shared/Buttons/ActionButton";
import { CodeViewer } from "@/components/shared/CodeViewer";

interface ViewTaskYamlButtonProps {
  yamlText: string;
  taskName: string;
}

export const ViewTaskYamlButton = ({
  yamlText,
  taskName,
}: ViewTaskYamlButtonProps) => {
  const [showCodeViewer, setShowCodeViewer] = useState(false);

  const handleClick = () => {
    setShowCodeViewer(true);
  };

  const handleClose = () => {
    setShowCodeViewer(false);
  };

  return (
    <>
      <ActionButton
        tooltip="View YAML"
        icon="FileCodeCorner"
        onClick={handleClick}
      />

      {showCodeViewer && (
        <CodeViewer
          code={yamlText}
          language="yaml"
          filename={taskName}
          fullscreen
          onClose={handleClose}
        />
      )}
    </>
  );
};
