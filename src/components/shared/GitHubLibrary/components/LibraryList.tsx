import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Text } from "@/components/ui/typography";
import { useComponentLibrary } from "@/providers/ComponentLibraryProvider";

export const LibraryList = withSuspenseWrapper(() => {
  const { existingComponentLibraries } = useComponentLibrary();

  return (
    <BlockStack gap="1">
      <ScrollArea className="w-full min-h-[100px] max-h-[500px]" type="always">
        {existingComponentLibraries?.length === 0 && (
          <InlineStack className="w-full">
            <Text>No libraries connected</Text>
          </InlineStack>
        )}

        {existingComponentLibraries?.map((library) => (
          <InlineStack
            key={library.id}
            align="space-between"
            blockAlign="center"
            gap="1"
            className="w-full pr-3"
          >
            <InlineStack blockAlign="center" gap="1">
              <Icon
                name={library.icon as any /** todo: fix this */}
                className="text-gray-400"
              />
              <Text>{library.name}</Text>
            </InlineStack>
            <InlineStack blockAlign="center" gap="1">
              <Button variant="ghost" size="sm">
                <Icon name="Check" />
              </Button>
              <Button variant="ghost" size="sm">
                <Icon name="X" />
              </Button>
            </InlineStack>
          </InlineStack>
        ))}
      </ScrollArea>
    </BlockStack>
  );
});
