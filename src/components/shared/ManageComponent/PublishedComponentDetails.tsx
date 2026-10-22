import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Heading, Paragraph, Text } from "@/components/ui/typography";
import type { HydratedComponentReference } from "@/utils/componentSpec";

import { withSuspenseWrapper } from "../SuspenseWrapper";
import { ComponentUsageCount } from "./ComponentUsageCount";
import { useHasPublishedComponent } from "./hooks/useHasPublishedComponent";
import { useOutdatedComponents } from "./hooks/useOutdatedComponents";
import { TrimmedDigest } from "./TrimmedDigest";

interface PublishedComponentDetailsProps {
  component: HydratedComponentReference;
  readOnly?: boolean;
}

function PublishedComponentDetailsSkeleton() {
  return (
    <InlineStack gap="1" align="center">
      <Spinner size={10} />
      <Text size="xs" tone="subdued">
        Looking for updates...
      </Text>
    </InlineStack>
  );
}

function PublishedComponentDetailsContent({
  component,
}: PublishedComponentDetailsProps) {
  const { data: isPublished } = useHasPublishedComponent(component);
  const { data: outdatedComponents } = useOutdatedComponents([component]);

  const outdatedComponentIndex = new Map(
    outdatedComponents.map(([c, m]) => [c.digest, m]),
  );

  if (!isPublished) {
    return null;
  }

  const isOutdated = outdatedComponentIndex.has(component.digest);

  return (
    <BlockStack className="w-full py-2 my-2 border rounded-md">
      <InlineStack
        blockAlign="start"
        align="space-between"
        className="w-full"
        gap="1"
      >
        <BlockStack className="w-[10%] p-2" inlineAlign="center" align="center">
          <Icon name="BookCheck" size="fill" />
        </BlockStack>
        <BlockStack className="w-[85%]">
          <Heading level={2}>This is a published component</Heading>
          <InlineStack gap="1" align="center">
            <TrimmedDigest
              digest={component.digest}
              tooltip={false}
              tone="info"
            />
            <ComponentUsageCount digest={component.digest}>
              {(count) => (
                <Text size="xs" tone="subdued">
                  | Used {count} times in this Pipeline.
                </Text>
              )}
            </ComponentUsageCount>
          </InlineStack>
          {isOutdated && (
            <InlineStack gap="1" align="center">
              <Paragraph size="xs" tone="critical">
                There is a newer version of this component available.
              </Paragraph>
            </InlineStack>
          )}
        </BlockStack>
      </InlineStack>
    </BlockStack>
  );
}

export const PublishedComponentDetails = withSuspenseWrapper(
  PublishedComponentDetailsContent,
  PublishedComponentDetailsSkeleton,
);
