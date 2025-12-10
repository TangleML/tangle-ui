import { CodeViewer } from "@/components/shared/CodeViewer";
import { useHydrateComponentReference } from "@/hooks/useHydrateComponentReference";
import type { ComponentReference, ComponentSpec } from "@/utils/componentSpec";
import { componentSpecToText } from "@/utils/yaml";

import { withSuspenseWrapper } from "../SuspenseWrapper";

interface TaskImplementationProps {
  displayName: string;
  componentRef?: ComponentReference;
  componentSpec?: ComponentSpec;
  fullscreen?: boolean;
  onClose?: () => void;
}

const TaskImplementation = withSuspenseWrapper(
  ({
    displayName,
    componentRef,
    componentSpec,
    fullscreen,
    onClose,
  }: TaskImplementationProps) => {
    if (componentRef) {
      return (
        <ComponentRefCodeViewer
          componentRef={componentRef}
          displayName={displayName}
          fullscreen={fullscreen}
          onClose={onClose}
        />
      );
    }

    if (componentSpec) {
      return (
        <ComponentSpecCodeViewer
          componentSpec={componentSpec}
          displayName={displayName}
          fullscreen={fullscreen}
          onClose={onClose}
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
    fullscreen,
    onClose,
  }: Omit<TaskImplementationProps, "componentSpec"> & {
    componentRef: ComponentReference;
  }) => {
    const hydratedComponentRef = useHydrateComponentReference(componentRef);

    if (!hydratedComponentRef) {
      return null;
    }

    return (
      <CodeViewer
        code={hydratedComponentRef.text}
        language="yaml"
        filename={displayName}
        fullscreen={fullscreen}
        onClose={onClose}
      />
    );
  },
);

const ComponentSpecCodeViewer = ({
  componentSpec,
  displayName,
  fullscreen,
  onClose,
}: Omit<TaskImplementationProps, "componentRef"> & {
  componentSpec: ComponentSpec;
}) => {
  const code = componentSpecToText(componentSpec);

  return (
    <CodeViewer
      code={code}
      language="yaml"
      filename={displayName}
      fullscreen={fullscreen}
      onClose={onClose}
    />
  );
};

export default TaskImplementation;
