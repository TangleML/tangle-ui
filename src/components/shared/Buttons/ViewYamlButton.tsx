import { type ComponentPropsWithoutRef, useState } from "react";

import type {
  ComponentSpec,
  HydratedComponentReference,
} from "@/utils/componentSpec";
import { getComponentName } from "@/utils/getComponentName";

import TaskImplementation from "../TaskDetails/Implementation";
import { ActionButton } from "./ActionButton";

type ViewYamlButtonProps = {
  displayLabel?: string;
  showTooltip?: boolean;
} & Omit<
  ComponentPropsWithoutRef<typeof ActionButton>,
  "children" | "icon" | "label" | "onClick" | "tooltip"
> &
  (
    | { componentRef: HydratedComponentReference; componentSpec?: never }
    | { componentSpec: ComponentSpec; componentRef?: never }
  );

export const ViewYamlButton = ({
  componentRef,
  componentSpec,
  displayLabel,
  showTooltip = true,
  ...rest
}: ViewYamlButtonProps) => {
  const [showCodeViewer, setShowCodeViewer] = useState(false);

  const name = componentRef
    ? getComponentName(componentRef)
    : componentSpec.name || "Component";

  const tooltipOrLabel = showTooltip
    ? { tooltip: "View YAML", label: displayLabel }
    : { label: displayLabel ?? "View YAML" };

  return (
    <>
      <ActionButton
        {...tooltipOrLabel}
        icon="FileCodeCorner"
        onClick={() => setShowCodeViewer(true)}
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
