import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Text } from "@/components/ui/typography";
import { useComponentLibrary } from "@/providers/ComponentLibraryProvider";
import type { StoredLibrary } from "@/providers/ComponentLibraryProvider/libraries/storage";

import { DeleteLibraryButton } from "./DeleteLibraryButton";
import { TokenStatusButton } from "./TokenStatusButton";

export const LibraryList = withSuspenseWrapper(
  ({
    onUpdateLibrary,
  }: {
    onUpdateLibrary: (library: StoredLibrary) => void;
  }) => {
    const { existingComponentLibraries } = useComponentLibrary();

    return (
      <BlockStack gap="1">
        <ScrollArea className="w-full min-h-25 max-h-125" type="always">
          {existingComponentLibraries?.length === 0 && (
            <InlineStack className="w-full">
              <Text>No libraries connected</Text>
            </InlineStack>
          )}

          {existingComponentLibraries?.map((library) => (
            <InlineStack
              key={library.id}
              align="space-between"
              gap="1"
              className="w-full pr-3"
            >
              <InlineStack gap="1">
                <Icon
                  name={library.icon as any /** todo: fix this */}
                  className="text-gray-400"
                />
                <Text>{library.name}</Text>
              </InlineStack>
              <InlineStack gap="1">
                <TokenStatusButton
                  library={library}
                  onUpdateClick={onUpdateLibrary}
                />

                <DeleteLibraryButton library={library} />
              </InlineStack>
            </InlineStack>
          ))}
        </ScrollArea>
      </BlockStack>
    );
  },
);
