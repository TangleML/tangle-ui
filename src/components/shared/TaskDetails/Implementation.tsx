import { CodeViewer } from "@/components/shared/CodeViewer";
import { useHydrateComponentReference } from "@/hooks/useHydrateComponentReference";
import type { ComponentReference, ComponentSpec } from "@/utils/componentSpec";
import { componentSpecToText } from "@/utils/yaml";

import { withSuspenseWrapper } from "../SuspenseWrapper";

interface TaskImplementationProps {
  displayName: string;
  componentRef?: ComponentReference;
  componentSpec?: ComponentSpec;
  showInlineContent?: boolean;
}

const TaskImplementation = withSuspenseWrapper(
  ({
    displayName,
    componentRef,
    componentSpec,
    showInlineContent = true,
  }: TaskImplementationProps) => {
    if (componentRef) {
      return (
        <ComponentRefCodeViewer
          componentRef={componentRef}
          displayName={displayName}
          showInlineContent={showInlineContent}
        />
      );
    }

    if (componentSpec) {
      return (
        <ComponentSpecCodeViewer
          componentSpec={componentSpec}
          displayName={displayName}
          showInlineContent={showInlineContent}
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
    showInlineContent = true,
  }: Pick<TaskImplementationProps, "displayName" | "showInlineContent"> & {
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
        showInlineContent={showInlineContent}
      />
    );
  },
);

const ComponentSpecCodeViewer = ({
  componentSpec,
  displayName,
  showInlineContent = true,
}: Pick<TaskImplementationProps, "displayName" | "showInlineContent"> & {
  componentSpec: ComponentSpec;
}) => {
  const code = componentSpecToText(componentSpec);

  return (
    <CodeViewer
      code={code}
      language="yaml"
      filename={displayName}
      showInlineContent={showInlineContent}
    />
  );
};

export default TaskImplementation;
