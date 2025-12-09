import "@/styles/editor.css";

import { DndContext } from "@dnd-kit/core";
import { ReactFlowProvider } from "@xyflow/react";

import PipelineEditor from "@/components/Editor/PipelineEditor";
import { InfoBox } from "@/components/shared/InfoBox";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { BlockStack } from "@/components/ui/layout";
import { Paragraph } from "@/components/ui/typography";
import { useLoadComponentSpecFromPath } from "@/hooks/useLoadComponentSpecFromPath";

const Editor = () => {
  const { componentSpec, error } = useLoadComponentSpecFromPath();

  if (error) {
    return (
      <BlockStack fill gap="4">
        <InfoBox variant="error" title="Error loading pipeline">
          {error}
        </InfoBox>
        <Paragraph tone="subdued" size="sm">
          Tip: Pipelines are stored locally and are not shareable by URL. To
          share a pipeline it needs to be exported.
        </Paragraph>
      </BlockStack>
    );
  }

  if (!componentSpec) {
    return <LoadingScreen message="Loading Pipeline" />;
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
