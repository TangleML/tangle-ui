import { useState } from "react";

import { Icon } from "@/components/ui/icon";
import type {
  ComponentSpec,
  HydratedComponentReference,
} from "@/utils/componentSpec";
import { getComponentName } from "@/utils/getComponentName";

import TaskImplementation from "../TaskDetails/Implementation";
import TooltipButton from "./TooltipButton";

type ViewYamlButtonProps =
  | { componentRef: HydratedComponentReference; componentSpec?: never }
  | { componentSpec: ComponentSpec; componentRef?: never };

export const ViewYamlButton = ({
  componentRef,
  componentSpec,
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
      <TooltipButton
        variant="outline"
        tooltip="View YAML"
        onClick={handleClick}
      >
        <Icon name="FileCodeCorner" />
      </TooltipButton>

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
