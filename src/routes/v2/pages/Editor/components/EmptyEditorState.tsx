import { useNavigate } from "@tanstack/react-router";

import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import type { PipelineRef } from "@/routes/PipelineFolders/context/FolderNavigationContext";
import { PipelineFolders } from "@/routes/PipelineFolders/PipelineFolders";
import { APP_ROUTES } from "@/routes/router";

export function EmptyEditorState() {
  const navigate = useNavigate();

  const handlePipelineClick = (pipeline: PipelineRef) => {
    navigate({
      to: APP_ROUTES.EDITOR_V2_PIPELINE,
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
        className="w-full max-w-5xl mx-auto bg-white p-4 rounded-lg shadow-md"
        gap="4"
      >
        <InlineStack gap="2" blockAlign="center">
          <Icon name="FolderOpen" size="md" className="text-stone-500" />
          <Text as="h2" size="lg" weight="semibold">
            Open Pipeline
          </Text>
        </InlineStack>
        <PipelineFolders onPipelineClick={handlePipelineClick} />
      </BlockStack>
    </BlockStack>
  );
}
