import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Paragraph } from "@/components/ui/typography";

import { Attribute, type AttributeProps } from "./Attribute";
import { ContentBlock } from "./ContentBlock";

export const KeyValueList = ({
  title,
  items,
}: {
  title?: string;
  items: AttributeProps[];
}) => {
  if (items.length === 0) {
    return (
      <ContentBlock title={title}>
        <Paragraph tone="subdued" size="xs">
          No items
        </Paragraph>
      </ContentBlock>
    );
  }

  return (
    <ContentBlock title={title}>
      <BlockStack>
        {items.map((item) => (
          <Row key={item.label} {...item} />
        ))}
      </BlockStack>
    </ContentBlock>
  );
};

function Row({ label, value, critical }: AttributeProps) {
  if (!value) {
    return null;
  }

  return (
    <InlineStack
      gap="1"
      align="space-between"
      blockAlign="center"
      className="px-2 py-0 rounded-xs w-full"
      wrap="nowrap"
    >
      <div className="flex-1 min-w-0">
        <Attribute label={label} value={value} critical={critical} copyable />
      </div>
    </InlineStack>
  );
}
