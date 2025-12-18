import { useState } from "react";

import { CodeViewer } from "@/components/shared/CodeViewer";
import type { ComponentSpec } from "@/utils/componentSpec";
import { componentSpecToText } from "@/utils/yaml";

interface TaskImplementationProps {
  displayName: string;
  componentSpec: ComponentSpec;
}

const TaskImplementation = ({
  displayName,
  componentSpec,
}: TaskImplementationProps) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

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
      isFullscreen={isFullscreen}
      onClose={() => setIsFullscreen(false)}
      onExpand={() => setIsFullscreen(true)}
    />
  );
};

export default TaskImplementation;
