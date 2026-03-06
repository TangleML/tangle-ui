import { useSearch } from "@tanstack/react-router";
import { useState } from "react";

import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Skeleton } from "@/components/ui/skeleton";

import { CreateFolderDialog } from "./components/CreateFolderDialog";
import { FolderBreadcrumb } from "./components/FolderBreadcrumb";
import { FolderGrid } from "./components/FolderGrid";
import { FolderPipelineTable } from "./components/FolderPipelineTable";
import { FolderNavigationContext } from "./context/FolderNavigationContext";

const PipelineFoldersSkeleton = () => (
  <BlockStack className="h-full p-6" gap="4">
    <InlineStack gap="2">
      <Skeleton size="lg" shape="button" />
      <Skeleton size="lg" shape="button" />
    </InlineStack>
    <BlockStack gap="2">
      <Skeleton size="full" />
      <Skeleton size="half" />
      <Skeleton size="full" />
      <Skeleton size="half" />
    </BlockStack>
  </BlockStack>
);

interface PipelineFoldersProps {
  onPipelineClick?: (name: string) => void;
}

export const PipelineFolders = withSuspenseWrapper(
  function PipelineFoldersContent({ onPipelineClick }: PipelineFoldersProps) {
    const { folderId: routeFolderId } = useSearch({ strict: false }) as {
      folderId?: string;
    };
    const [localFolderId, setLocalFolderId] = useState<string | null>(null);

    const isEmbedded = onPipelineClick !== undefined;
    const currentFolderId = isEmbedded
      ? localFolderId
      : (routeFolderId ?? null);

    const content = (
      <BlockStack
        gap="4"
        className="p-6"
        fill
        inlineAlign="start"
        align="start"
      >
        <FolderGrid />

        <InlineStack
          align="space-between"
          blockAlign="center"
          className="w-full"
        >
          <FolderBreadcrumb folderId={currentFolderId} />
          <CreateFolderDialog parentId={currentFolderId} />
        </InlineStack>

        <FolderPipelineTable folderId={currentFolderId} />
      </BlockStack>
    );

    if (isEmbedded) {
      return (
        <FolderNavigationContext.Provider
          value={{ navigateToFolder: setLocalFolderId, onPipelineClick }}
        >
          {content}
        </FolderNavigationContext.Provider>
      );
    }

    return content;
  },
  PipelineFoldersSkeleton,
);
