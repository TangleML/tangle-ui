import { PackagePlus } from "lucide-react";
import { type ChangeEvent } from "react";

import { ManageLibrariesDialog } from "@/components/shared/GitHubLibrary/ManageLibrariesDialog";
import { useFlagValue } from "@/components/shared/Settings/useFlags";
import { BlockStack, InlineStack } from "@/components/ui/layout";
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
import { Text } from "@/components/ui/typography";
import { useComponentLibrary } from "@/providers/ComponentLibraryProvider";
import { useForcedSearchContext } from "@/providers/ComponentLibraryProvider/ForcedSearchProvider";
import type { UIComponentFolder } from "@/types/componentLibrary";

import {
  ErrorState,
  FolderItem,
  ImportComponent,
  LoadingState,
  SearchInput,
  SearchResults,
} from "../components";
import { IONodeSidebarItem } from "../components/ComponentItem";
import { LibraryFolderItem } from "../components/FolderItem";
import PublishedComponentsSearch from "../components/PublishedComponentsSearch";
import { UpgradeAvailableAlertBox } from "../components/UpgradeAvailableAlertBox";

const GraphComponents = ({ isOpen }: { isOpen: boolean }) => {
  const remoteComponentLibrarySearchEnabled = useFlagValue(
    "remote-component-library-search",
  );
  const { updateSearchFilter, currentSearchFilter } = useForcedSearchContext();

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    updateSearchFilter({
      searchTerm: e.target.value,
    });
  };

  const handleFiltersChange = (filters: string[]) => {
    updateSearchFilter({
      filters,
    });
  };

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
    <PublishedComponentsSearch>
      <ComponentLibrarySection />
    </PublishedComponentsSearch>
  ) : (
    <>
      <SearchInput
        value={currentSearchFilter.searchTerm}
        activeFilters={currentSearchFilter.filters}
        onChange={handleSearchChange}
        onFiltersChange={handleFiltersChange}
      />

      <ComponentLibrarySection />
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
    </SidebarGroup>
  );
};

function ComponentLibrarySection() {
  const remoteComponentLibrarySearchEnabled = useFlagValue(
    "remote-component-library-search",
  );

  const githubComponentLibraryEnabled = useFlagValue(
    "github-component-library",
  );

  const { getComponentLibrary, existingComponentLibraries } =
    useComponentLibrary();

  const favoriteComponentsLibrary = getComponentLibrary("favorite_components");
  const userComponentsLibrary = getComponentLibrary("user_components");

  const { updateSearchFilter } = useForcedSearchContext();
  const { usedComponentsFolder, isLoading, error, searchResult } =
    useComponentLibrary();

  const standardComponentsLibrary = getComponentLibrary("standard_components");

  const handleFiltersChange = (filters: string[]) => {
    updateSearchFilter({
      filters,
    });
  };

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={(error as Error).message} />;

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

        <LibraryFolderItem
          key="favorite-components-folder-v2"
          library={favoriteComponentsLibrary}
          icon="Star"
        />

        <LibraryFolderItem
          key="my-components-library-folder"
          library={userComponentsLibrary}
          icon="Puzzle"
        />
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
        <LibraryFolderItem
          key="standard-library-folder-v2"
          library={standardComponentsLibrary}
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
}

export default GraphComponents;
