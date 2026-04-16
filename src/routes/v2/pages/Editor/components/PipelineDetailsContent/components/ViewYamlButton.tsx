import { useState } from "react";

import { ActionButton } from "@/components/shared/Buttons/ActionButton";
import { CodeViewer } from "@/components/shared/CodeViewer";
import type { ComponentSpec } from "@/models/componentSpec";
import { serializeComponentSpecToText } from "@/models/componentSpec";

interface ViewYamlButtonProps {
  spec: ComponentSpec;
}

export const ViewYamlButton = ({ spec }: ViewYamlButtonProps) => {
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
          code={serializeComponentSpecToText(spec)}
          language="yaml"
          filename={spec.name}
          fullscreen
          onClose={handleClose}
        />
      )}
    </>
  );
};
