import yaml from "js-yaml";
import { useState } from "react";

import { ActionButton } from "@/components/shared/Buttons/ActionButton";
import { CodeViewer } from "@/components/shared/CodeViewer";
import type { ComponentSpec } from "@/models/componentSpec";
import { JsonSerializer } from "@/models/componentSpec";

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
          code={yaml.dump(new JsonSerializer().serialize(spec), {
            lineWidth: -1,
            noRefs: true,
            indent: 2,
          })}
          language="yaml"
          filename={spec.name}
          fullscreen
          onClose={handleClose}
        />
      )}
    </>
  );
};
