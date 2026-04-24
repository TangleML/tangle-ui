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
  "data-tracking-id"?: string;
  "data-tracking-metadata"?: string;
} & (
  | { componentRef: HydratedComponentReference; componentSpec?: never }
  | { componentSpec: ComponentSpec; componentRef?: never }
);

export const ViewYamlButton = ({
  componentRef,
  componentSpec,
  displayLabel,
  ...rest
}: ViewYamlButtonProps) => {
  const [showCodeViewer, setShowCodeViewer] = useState(false);

  const name = componentRef
    ? getComponentName(componentRef)
    : componentSpec.name || "Component";

  return (
    <>
      <ActionButton
        tooltip="View YAML"
        icon="FileCodeCorner"
        onClick={() => setShowCodeViewer(true)}
        label={displayLabel}
        {...rest}
      />

      {showCodeViewer && (
        <TaskImplementation
          componentRef={componentRef}
          componentSpec={componentSpec}
          displayName={name}
          fullscreen
          onClose={() => setShowCodeViewer(false)}
        />
      )}
    </>
  );
};
