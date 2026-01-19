import { useState } from "react";

import type {
  ComponentSpec,
  HydratedComponentReference,
} from "@/utils/componentSpec";
import { getComponentName } from "@/utils/getComponentName";

import TaskImplementation from "../TaskDetails/Implementation";
import { ActionButton } from "./ActionButton";

type ViewYamlButtonProps = {
  displayLabel?: string;
} & (
  | { componentRef: HydratedComponentReference; componentSpec?: never }
  | { componentSpec: ComponentSpec; componentRef?: never }
);

export const ViewYamlButton = ({
  componentRef,
  componentSpec,
  displayLabel,
}: ViewYamlButtonProps) => {
  const [showCodeViewer, setShowCodeViewer] = useState(false);

  const name = componentRef
    ? getComponentName(componentRef)
    : componentSpec.name || "Component";

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
        label={displayLabel}
      />

      {showCodeViewer && (
        <TaskImplementation
          componentRef={componentRef}
          componentSpec={componentSpec}
          displayName={name}
          fullscreen
          onClose={handleClose}
        />
      )}
    </>
  );
};
