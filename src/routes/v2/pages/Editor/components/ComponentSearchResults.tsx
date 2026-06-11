import {
  ComponentMarkup,
  IONodeSidebarItem,
  StickyNoteSidebarItem,
} from "@/components/shared/ReactFlow/FlowSidebar/components/ComponentItem";
import FolderItem from "@/components/shared/ReactFlow/FlowSidebar/components/FolderItem";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Paragraph, Text } from "@/components/ui/typography";
import type { UIComponentFolder } from "@/types/componentLibrary";

import type { ComponentSearchV2Result } from "./componentSearchV2Logic";

interface ComponentSearchResultsProps {
  query: string;
  results: ComponentSearchV2Result[];
  browseFolders: UIComponentFolder[];
  isLoading: boolean;
}

export function ComponentSearchResults({
  query,
  results,
  browseFolders,
  isLoading,
}: ComponentSearchResultsProps) {
  if (isLoading) {
    return (
      <BlockStack gap="2" className="px-2">
        <InlineStack align="start" gap="1">
          <Text tone="subdued">Search Results </Text>
          <Spinner />
        </InlineStack>
      </BlockStack>
    );
  }

  const isEmptyQuery = query.trim().length === 0;

  if (isEmptyQuery) {
    return (
      <BlockStack
        className="px-2 min-h-0 flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin [&_li]:marker:hidden [&_li]:before:content-none [&_li]:list-none"
        data-testid="search-results-container"
      >
        <FolderItem
          folder={{
            name: "Canvas Tools",
            components: [<StickyNoteSidebarItem key="sticky-note" />],
          }}
          icon="ToolCase"
        />
        <FolderItem
          folder={{
            name: "Inputs & Outputs",
            components: [
              <IONodeSidebarItem key="input" nodeType="input" />,
              <IONodeSidebarItem key="output" nodeType="output" />,
            ],
          }}
          icon="Cable"
        />
        {browseFolders.map((folder) => (
          <FolderItem key={folder.name} folder={folder} />
        ))}
      </BlockStack>
    );
  }

  return (
    <BlockStack
      gap="2"
      className="px-2 min-h-0 flex-1"
      data-testid="search-results-container"
    >
      <Text tone="subdued" data-testid="search-results-header">
        Search Results ({results.length})
      </Text>
      <Separator />
      <div className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin">
        {results.length > 0 ? (
          <BlockStack
            as="ul"
            className="[&_li]:marker:hidden [&_li]:before:content-none [&_li]:list-none"
          >
            {results.map((result) => (
              <ComponentMarkup
                key={`${result.reference.digest}-${result.reference.name ?? result.reference.url ?? "component"}`}
                component={result.reference}
                rerankScore={result.rerankScore}
              />
            ))}
          </BlockStack>
        ) : (
          <Paragraph size="sm" tone="subdued">
            No results found
          </Paragraph>
        )}
      </div>
    </BlockStack>
  );
}
