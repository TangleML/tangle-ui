import "@/styles/editor.css";

import { DndContext } from "@dnd-kit/core";
import { ReactFlowProvider } from "@xyflow/react";

import PipelineEditor from "@/components/Editor/PipelineEditor";
import { InfoBox } from "@/components/shared/InfoBox";
import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { useLoadComponentSpecFromPath } from "@/hooks/useLoadComponentSpecFromPath";

const Editor = () => {
  const { componentSpec, error } = useLoadComponentSpecFromPath();

  if (error) {
    return (
      <BlockStack
        align="center"
        inlineAlign="center"
        gap="4"
        className="h-full"
      >
        <InfoBox variant="error" title="Error loading pipeline">
          {error}
        </InfoBox>
        <Text tone="subdued" size="sm">
          Tip: Pipelines are stored locally and are not shareable by URL. To
          share a pipeline it needs to be exported.
        </Text>
      </BlockStack>
    );
  }

  if (!componentSpec) {
    return <div>Loading...</div>;
  }

  return (
    <DndContext>
      <ReactFlowProvider>
        <PipelineEditor />
      </ReactFlowProvider>
    </DndContext>
  );
};

export default Editor;
