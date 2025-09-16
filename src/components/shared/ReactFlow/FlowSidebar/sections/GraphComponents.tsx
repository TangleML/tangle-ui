import { PackagePlus } from "lucide-react";
import { type ChangeEvent, useCallback, useMemo } from "react";

import { useBetaFlagValue } from "@/components/shared/Settings/useBetaFlags";
import { BlockStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useComponentLibrary } from "@/providers/ComponentLibraryProvider";
import { useForcedSearchContext } from "@/providers/ComponentLibraryProvider/ForcedSearchProvider";
import { FAVORITE_COMPONENTS_LIBRARY_ID } from "@/providers/ComponentLibraryProvider/libraries/migrateLegacyFavoriteFolder";
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
import AddGitHubLibraryDialog from "../components/AddGitHubLibraryDialog";
import { IONodeSidebarItem } from "../components/ComponentItem";
import { LibraryFolderItem } from "../components/FolderItem";
import PublishedComponentsSearch from "../components/PublishedComponentsSearch";
import { UpgradeAvailableAlertBox } from "../components/UpgradeAvailableAlertBox";

const GraphComponents = ({ isOpen }: { isOpen: boolean }) => {
  const remoteComponentLibrarySearchEnabled = useBetaFlagValue(
    "remote-component-library-search",
  );
  const componentLibraryV2Enabled = useBetaFlagValue("component-library-v2");

  const { getComponentLibrary, existingComponentLibraries } =
    useComponentLibrary();
  const favoriteComponentsLibrary = getComponentLibrary(
    FAVORITE_COMPONENTS_LIBRARY_ID,
  );
  const standardComponentsLibrary = getComponentLibrary("standard_components");
  const usedComponentsLibrary = getComponentLibrary("used_components");

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
      !componentLibraryV2Enabled &&
      usedComponentsFolder?.components &&
      usedComponentsFolder.components.length > 0;

    const hasFavouriteComponents =
      !componentLibraryV2Enabled &&
      favoritesFolder?.components &&
      favoritesFolder.components.length > 0;

    const hasUserComponents =
      userComponentsFolder?.components &&
      userComponentsFolder.components.length > 0;

    return (
      <BlockStack gap="2">
        {remoteComponentLibrarySearchEnabled && <UpgradeAvailableAlertBox />}

        <BlockStack>
          {hasUsedComponents && (
            <FolderItem
              key="used-components-folder"
              folder={usedComponentsFolder}
              icon="LayoutGrid"
            />
          )}
          {componentLibraryV2Enabled ? (
            <LibraryFolderItem
              key="used-components-folder-v2"
              library={usedComponentsLibrary}
              icon="LayoutGrid"
            />
          ) : null}
          {hasFavouriteComponents && (
            <FolderItem
              key="favorite-components-folder"
              folder={favoritesFolder}
              icon="Star"
            />
          )}
          {componentLibraryV2Enabled
            ? existingComponentLibraries?.map((library) => (
                <LibraryFolderItem
                  key={library.id}
                  library={getComponentLibrary(
                    library.id as any /** todo: fix this */,
                  )}
                  icon={library.icon as any /** todo: fix this */}
                />
              ))
            : null}

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
          {componentLibraryV2Enabled ? null : (
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
          )}
          {componentLibraryV2Enabled ? (
            <LibraryFolderItem
              key="standard-library-folder-v2"
              library={standardComponentsLibrary}
              icon="Folder"
            />
          ) : null}
        </BlockStack>
      </BlockStack>
    );
  }, [
    componentLibrary,
    usedComponentsFolder,
    userComponentsFolder,
    favoritesFolder,
    componentLibraryV2Enabled,
    isLoading,
    error,
    searchResult,
    remoteComponentLibrarySearchEnabled,
    handleFiltersChange,
    favoriteComponentsLibrary,
    standardComponentsLibrary,
    usedComponentsLibrary,
    existingComponentLibraries,
  ]);

  if (!isOpen) {
    return (
      <>
        <hr />
        <SidebarGroup className="my-2! pt-0">
          <SidebarGroupContent>
            <SidebarMenuButton
              tooltip="Add Component"
              forceTooltip
              tooltipPosition={isOpen ? "top" : "right"}
              className="cursor-pointer"
            >
              <ImportComponent
                triggerComponent={
                  <PackagePlus className="w-4 h-4" strokeWidth={1.5} />
                }
              />
            </SidebarMenuButton>
          </SidebarGroupContent>
        </SidebarGroup>
      </>
    );
  }

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

  return (
    <SidebarGroup>
      <SidebarGroupLabel>
        <div className="flex items-center justify-between gap-2 w-full">
          <div>Components</div>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <ImportComponent />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">Add component</TooltipContent>
          </Tooltip>
        </div>
      </SidebarGroupLabel>
      <SidebarGroupContent className="[&_li]:marker:hidden [&_li]:before:content-none [&_li]:list-none">
        {searchComponent}
      </SidebarGroupContent>
      {componentLibraryV2Enabled && (
        <SidebarGroupContent>
          <BlockStack className="mt-8">
            <AddGitHubLibraryDialog />
          </BlockStack>
        </SidebarGroupContent>
      )}
    </SidebarGroup>
  );
};

export default GraphComponents;
