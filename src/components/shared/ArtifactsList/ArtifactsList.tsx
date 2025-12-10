import { type ReactNode } from "react";

import { CopyText } from "@/components/shared/CopyText/CopyText";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

interface ArtifactItem {
  name: string;
  type: string;
  value?: string;
  actions?: ReactNode;
}

interface ArtifactsSectionProps {
  title: string;
  items: ArtifactItem[];
  emptyMessage?: string;
  disableCopy?: boolean;
}

const ArtifactsSection = ({
  title,
  items,
  emptyMessage = "None",
  disableCopy = false,
}: ArtifactsSectionProps) => (
  <BlockStack className="w-full">
    <Text as="h4" size="sm" weight="semibold" className="mb-1">
      {title}
    </Text>
    {items.length > 0 ? (
      <BlockStack className="w-full">
        {items.map((item) => (
          <InlineStack
            key={item.name}
            gap="2"
            align="space-between"
            className="even:bg-white odd:bg-gray-100 p-2 rounded-xs w-full"
          >
            <InlineStack
              gap="1"
              wrap="nowrap"
              className="flex-1 min-w-0 text-xs"
            >
              <Text as="span" weight="semibold" className="shrink-0">
                {item.name}:
              </Text>
              {item.value !== undefined ? (
                !disableCopy ? (
                  <CopyText className="truncate">
                    {item.value || "No value"}
                  </CopyText>
                ) : (
                  <Text as="span" className="truncate">
                    {item.value || "No value"}
                  </Text>
                )
              ) : (
                <Text as="span" tone="subdued">
                  —
                </Text>
              )}
            </InlineStack>
            <Text size="xs" tone="subdued" className="shrink-0">
              {item.type}
            </Text>
            {item.actions}
          </InlineStack>
        ))}
      </BlockStack>
    ) : (
      <Text size="xs" tone="subdued">
        {emptyMessage}
      </Text>
    )}
  </BlockStack>
);

interface ArtifactsListProps {
  inputs: ArtifactItem[];
  outputs: ArtifactItem[];
}

export const ArtifactsList = ({ inputs, outputs }: ArtifactsListProps) => (
  <BlockStack className="w-full">
    <Text as="h3" size="md" weight="semibold" className="mb-1">
      Artifacts
    </Text>
    <BlockStack gap="4" className="w-full">
      <ArtifactsSection
        title="Inputs"
        items={inputs}
        emptyMessage="No inputs"
      />
      <ArtifactsSection
        title="Outputs"
        items={outputs}
        emptyMessage="No outputs"
        disableCopy
      />
    </BlockStack>
  </BlockStack>
);
