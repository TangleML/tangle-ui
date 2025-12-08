import { CodeViewer } from "@/components/shared/CodeViewer";
import type { ComponentSpec } from "@/utils/componentSpec";
import { componentSpecToText } from "@/utils/yaml";

interface TaskImplementationProps {
  displayName: string;
  componentSpec: ComponentSpec;
  showInlineContent?: boolean;
}

const TaskImplementation = ({
  displayName,
  componentSpec,
  showInlineContent = true,
}: TaskImplementationProps) => {
  const code = componentSpecToText(componentSpec);

  if (!componentSpec?.implementation) {
    return (
      <div className="text-sm text-gray-500 p-4 border rounded-md">
        No implementation code found for this component.
      </div>
    );
  }

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
