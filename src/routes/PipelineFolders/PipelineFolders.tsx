import { useSearch } from "@tanstack/react-router";

import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Skeleton } from "@/components/ui/skeleton";

import { CreateFolderDialog } from "./components/CreateFolderDialog";
import { FolderBreadcrumb } from "./components/FolderBreadcrumb";
import { FolderGrid } from "./components/FolderGrid";
import { FolderPipelineTable } from "./components/FolderPipelineTable";

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

export const PipelineFolders = withSuspenseWrapper(
  function PipelineFoldersContent() {
    const { folderId } = useSearch({ strict: false }) as {
      folderId?: string;
    };

    const currentFolderId = folderId ?? null;

    return (
      <BlockStack gap="4" className="w-full p-6">
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
  },
  PipelineFoldersSkeleton,
);
