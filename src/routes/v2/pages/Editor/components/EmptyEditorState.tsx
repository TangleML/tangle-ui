import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Heading } from "@/components/ui/typography";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { APP_ROUTES } from "@/routes/router";
// TODO: extract PipelineFolders picker to shared or restructure via routing composition
// eslint-disable-next-line no-restricted-imports
import { PipelineFolders } from "@/routes/v2/pages/PipelineFolders/PipelineFolders";
import type { PipelineRef } from "@/services/pipelineStorage/types";

export function EmptyEditorState() {
  const navigate = useNavigate();
  const { track } = useAnalytics();

  useEffect(() => {
    track("v2.pipeline_editor.empty_state.impression");
  }, [track]);

  const handlePipelineClick = (pipeline: PipelineRef) => {
    navigate({
      to: APP_ROUTES.PIPELINE_EDITOR,
      params: { pipelineName: pipeline.name },
      search: { fileId: pipeline.fileId },
    });
  };

  return (
    <BlockStack
      className="flex-1 min-h-0 w-full overflow-auto p-8"
      align="center"
    >
      <BlockStack
        className="w-full max-w-5xl mx-auto bg-card p-4 rounded-lg shadow-md"
        gap="4"
      >
        <InlineStack gap="2" blockAlign="center">
          <Icon name="FolderOpen" size="md" className="text-stone-500" />
          <Heading level={2} size="lg" weight="semibold">
            Open Pipeline
          </Heading>
        </InlineStack>
        <PipelineFolders onPipelineClick={handlePipelineClick} />
      </BlockStack>
    </BlockStack>
  );
}
