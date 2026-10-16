import "@/styles/editor.css";

import { DndContext } from "@dnd-kit/core";
import { useParams } from "@tanstack/react-router";
import { ReactFlowProvider } from "@xyflow/react";
import { useEffect } from "react";

import PipelineEditor from "@/components/Editor/PipelineEditor";
import { InfoBox } from "@/components/shared/InfoBox";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { BlockStack } from "@/components/ui/layout";
import { Paragraph } from "@/components/ui/typography";
import { useLoadComponentSpecFromPath } from "@/hooks/useLoadComponentSpecFromPath";
import { addRecentlyViewed } from "@/hooks/useRecentlyViewed";

const LocalEditor = () => {
  const { componentSpec, error } = useLoadComponentSpecFromPath();
  useEffect(() => {
    if (!componentSpec?.name) return;
    addRecentlyViewed({
      type: "pipeline",
      id: componentSpec.name,
      name: componentSpec.name,
    });
  }, [componentSpec?.name]);

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

const Editor = () => {
  const params = useParams({ strict: false });
  if ("pipelineId" in params) {
    return <div className="h-full w-full bg-slate-100 dark:bg-background" />;
  }
  return <LocalEditor />;
};

export default Editor;
