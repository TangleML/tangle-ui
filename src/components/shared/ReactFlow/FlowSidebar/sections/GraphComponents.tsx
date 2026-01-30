import { type ChangeEvent, useCallback, useMemo } from "react";

import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { ManageLibrariesDialog } from "@/components/shared/GitHubLibrary/ManageLibrariesDialog";
import { useFlagValue } from "@/components/shared/Settings/useFlags";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/typography";
import { useComponentLibrary } from "@/providers/ComponentLibraryProvider";
import { useForcedSearchContext } from "@/providers/ComponentLibraryProvider/ForcedSearchProvider";
import type { UIComponentFolder } from "@/types/componentLibrary";

import {
  EmptyState,
  ErrorState,
  FolderItem,
  ImportComponent,
  LoadingState,
  SearchInput,
  SearchResults,
} from "../components";
import {
  IONodeSidebarItem,
  StickyNoteSidebarItem,
} from "../components/ComponentItem";
import { LibraryFolderItem } from "../components/FolderItem";
import PublishedComponentsSearch from "../components/PublishedComponentsSearch";
import { SidebarSection } from "../components/SidebarSection";
import { UpgradeAvailableAlertBox } from "../components/UpgradeAvailableAlertBox";

const GraphComponents = () => {
  const remoteComponentLibrarySearchEnabled = useFlagValue(
    "remote-component-library-search",
  );
  const githubComponentLibraryEnabled = useFlagValue(
    "github-component-library",
  );

  const { getComponentLibrary, existingComponentLibraries } =
    useComponentLibrary();

  const { updateSearchFilter, currentSearchFilter } = useForcedSearchContext();
  const {
    componentLibrary,
    usedComponentsFolder,
    userComponentsFolder,
    favoritesFolder,
    isLoading,
    error,
    searchResult,
  } = useComponentLibrary();

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    updateSearchFilter({
      searchTerm: e.target.value,
    });
  };

  const handleFiltersChange = useCallback(
    (filters: string[]) => {
      updateSearchFilter({
        filters,
      });
    },
    [updateSearchFilter],
  );

  const memoizedContent = useMemo(() => {
    if (isLoading) return <LoadingState />;
    if (error) return <ErrorState message={(error as Error).message} />;
    if (!componentLibrary) return <EmptyState />;

    if (!remoteComponentLibrarySearchEnabled && searchResult) {
      // If there's a search result, use the SearchResults component
      return (
        <SearchResults
          searchResult={searchResult}
          onFiltersChange={handleFiltersChange}
        />
      );
    }

    // Otherwise show the regular folder structure
    const hasUsedComponents =
      usedComponentsFolder?.components &&
      usedComponentsFolder.components.length > 0;

    const hasFavouriteComponents =
      favoritesFolder?.components && favoritesFolder.components.length > 0;

    const hasUserComponents =
      userComponentsFolder?.components &&
      userComponentsFolder.components.length > 0;

    return (
      <BlockStack gap="2">
        {remoteComponentLibrarySearchEnabled && <UpgradeAvailableAlertBox />}

        <BlockStack>
          <FolderItem
            key="canvas-tools-folder"
            folder={
              {
                name: "Canvas Tools",
                components: [<StickyNoteSidebarItem key="sticky-note" />],
                folders: [],
              } as UIComponentFolder
            }
            icon="ToolCase"
          />
          <Separator />
          {hasUsedComponents && (
            <FolderItem
              key="used-components-folder"
              folder={usedComponentsFolder}
              icon="LayoutGrid"
            />
          )}
          {hasFavouriteComponents && (
            <FolderItem
              key="favorite-components-folder"
              folder={favoritesFolder}
              icon="Star"
            />
          )}
          {hasUserComponents && (
            <FolderItem
              key="my-components-folder"
              folder={userComponentsFolder}
              icon="Puzzle"
            />
          )}
          <Separator />
          <FolderItem
            key="graph-inputs-outputs-folder"
            folder={
              {
                name: "Inputs & Outputs",
                components: [
                  <IONodeSidebarItem key="input" nodeType="input" />,
                  <IONodeSidebarItem key="output" nodeType="output" />,
                ],
                folders: [],
              } as UIComponentFolder
            }
            icon="Cable"
          />
          <Separator />
          <FolderItem
            key="standard-library-folder"
            folder={
              {
                name: "Standard library",
                components: [],
                folders: componentLibrary.folders,
              } as UIComponentFolder
            }
            icon="Folder"
          />
          {githubComponentLibraryEnabled && (
            <>
              <Separator />
              <BlockStack gap="1" className="pl-2 py-2">
                <InlineStack className="w-full" align="space-between">
                  <Text size="sm" tone="subdued">
                    Connected libraries
                  </Text>
                  <ManageLibrariesDialog />
                </InlineStack>

                {existingComponentLibraries?.length === 0 && (
                  <BlockStack gap="1" align="center">
                    <Text size="sm" tone="subdued">
                      No libraries connected
                    </Text>
                  </BlockStack>
                )}
              </BlockStack>

              {existingComponentLibraries?.map((library) => (
                <LibraryFolderItem
                  key={library.id}
                  library={getComponentLibrary(library.id)}
                  icon={library.icon as any /** todo: fix this */}
                />
              ))}
            </>
          )}
        </BlockStack>
      </BlockStack>
    );
  }, [
    componentLibrary,
    usedComponentsFolder,
    userComponentsFolder,
    favoritesFolder,
    isLoading,
    error,
    searchResult,
    remoteComponentLibrarySearchEnabled,
    githubComponentLibraryEnabled,
    existingComponentLibraries,
    getComponentLibrary,
  ]);

  const searchComponent = remoteComponentLibrarySearchEnabled ? (
    <PublishedComponentsSearch>{memoizedContent}</PublishedComponentsSearch>
  ) : (
    <>
      <SearchInput
        value={currentSearchFilter.searchTerm}
        activeFilters={currentSearchFilter.filters}
        onChange={handleSearchChange}
        onFiltersChange={handleFiltersChange}
      />

      {memoizedContent}
    </>
  );

  const importComponentAction = (
    <ImportComponent
      triggerComponent={
        <TooltipButton variant="ghost" tooltip="Add component">
          <Icon name="PackagePlus" />
        </TooltipButton>
      }
    />
  );

  return (
    <SidebarSection
      title="Components"
      headerAction={importComponentAction}
      className="flex-1 overflow-hidden"
    >
      <BlockStack className="overflow-y-auto flex-1 [&_li]:marker:hidden [&_li]:before:content-none [&_li]:list-none">
        {searchComponent}
      </BlockStack>
    </SidebarSection>
  );
};

export default GraphComponents;
