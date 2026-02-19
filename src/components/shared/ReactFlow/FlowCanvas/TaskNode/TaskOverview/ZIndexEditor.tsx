import { ContentBlock } from "@/components/shared/ContextPanel/Blocks/ContentBlock";
import type { TaskNodeContextType } from "@/providers/TaskNodeProvider";
import { ZINDEX_ANNOTATION } from "@/utils/annotations";

import { StackingControls } from "../../../FlowControls/StackingControls";

interface ZIndexEditorProps {
  taskNode: TaskNodeContextType;
}

export const ZIndexEditor = ({ taskNode }: ZIndexEditorProps) => {
  const handleStackingControlChange = (newZIndex: number) => {
    const updatedAnnotations = {
      ...taskNode.taskSpec?.annotations,
      [ZINDEX_ANNOTATION]: `${newZIndex}`,
    };

    taskNode.callbacks.setAnnotations(updatedAnnotations);
  };

  return (
    <ContentBlock className="border rounded-lg p-2 bg-background w-fit mx-auto">
      <StackingControls
        nodeId={taskNode.nodeId}
        onChange={handleStackingControlChange}
      />
    </ContentBlock>
  );
};
