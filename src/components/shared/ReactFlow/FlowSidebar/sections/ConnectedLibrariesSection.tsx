import { ManageLibrariesDialog } from "@/components/shared/GitHubLibrary/ManageLibrariesDialog";
import { useFlagValue } from "@/components/shared/Settings/useFlags";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/typography";
import { useComponentLibrary } from "@/providers/ComponentLibraryProvider";

import { LibraryFolderItem } from "../components/FolderItem";

export const ConnectedLibrariesSection = () => {
  const githubComponentLibraryEnabled = useFlagValue(
    "github-component-library",
  );
  const { getComponentLibrary, existingComponentLibraries } =
    useComponentLibrary();

  if (!githubComponentLibraryEnabled) return null;

  return (
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
          icon={library.icon}
        />
      ))}
    </>
  );
};
