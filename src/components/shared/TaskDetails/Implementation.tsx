import { useState } from "react";

import { CodeViewer } from "@/components/shared/CodeViewer";
import { useHydrateComponentReference } from "@/hooks/useHydrateComponentReference";
import type { ComponentReference, ComponentSpec } from "@/utils/componentSpec";
import { componentSpecToText } from "@/utils/yaml";

import { withSuspenseWrapper } from "../SuspenseWrapper";

interface TaskImplementationProps {
  displayName: string;
  componentRef?: ComponentReference;
  componentSpec?: ComponentSpec;
}

const TaskImplementation = withSuspenseWrapper(
  ({ displayName, componentRef, componentSpec }: TaskImplementationProps) => {
    if (componentRef) {
      return (
        <ComponentRefCodeViewer
          componentRef={componentRef}
          displayName={displayName}
        />
      );
    }

    if (componentSpec) {
      return (
        <ComponentSpecCodeViewer
          componentSpec={componentSpec}
          displayName={displayName}
        />
      );
    }

    return (
      <div className="text-sm text-gray-500 p-4 border rounded-md">
        No implementation code found for this component.
      </div>
    );
  },
);

const ComponentRefCodeViewer = withSuspenseWrapper(
  ({
    componentRef,
    displayName,
  }: Pick<TaskImplementationProps, "displayName"> & {
    componentRef: ComponentReference;
  }) => {
    const [isFullscreen, setIsFullscreen] = useState(false);

    const hydratedComponentRef = useHydrateComponentReference(componentRef);

    if (!hydratedComponentRef) {
      return null;
    }

    return (
      <CodeViewer
        code={hydratedComponentRef.text}
        language="yaml"
        filename={displayName}
        isFullscreen={isFullscreen}
        onClose={() => setIsFullscreen(false)}
        onExpand={() => setIsFullscreen(true)}
      />
    );
  },
);

const ComponentSpecCodeViewer = ({
  componentSpec,
  displayName,
}: Pick<TaskImplementationProps, "displayName"> & {
  componentSpec: ComponentSpec;
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const code = componentSpecToText(componentSpec);

  return (
    <CodeViewer
      code={code}
      language="yaml"
      filename={displayName}
      isFullscreen={isFullscreen}
      onClose={() => setIsFullscreen(false)}
      onExpand={() => setIsFullscreen(true)}
    />
  );
};

export default TaskImplementation;
