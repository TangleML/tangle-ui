import { observer } from "mobx-react-lite";

import { LinkNodeButton } from "@/components/shared/Buttons/LinkNodeButton";
import { ActionBlock } from "@/components/shared/ContextPanel/Blocks/ActionBlock";
import { CopyText } from "@/components/shared/CopyText/CopyText";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";

interface RunViewOutputDetailsProps {
  entityId: string;
}

export const RunViewOutputDetails = observer(function RunViewOutputDetails({
  entityId,
}: RunViewOutputDetailsProps) {
  const spec = useSpec();
  const output = spec?.outputs.find((o) => o.$id === entityId);

  if (!output) {
    return (
      <BlockStack className="p-4">
        <Text size="sm" tone="subdued">
          Output not found
        </Text>
      </BlockStack>
    );
  }

  const type = output.type ? String(output.type) : undefined;

  return (
    <BlockStack
      gap="4"
      className="h-full px-2"
      data-context-panel="output-overview"
    >
      <InlineStack gap="2" blockAlign="center">
        <Icon name="Upload" size="sm" className="text-green-500 shrink-0" />
        <CopyText size="lg" className="font-semibold wrap-anywhere">
          {output.name}
        </CopyText>
      </InlineStack>

      <ActionBlock
        actions={[<LinkNodeButton key="link" nodeId={output.name} />]}
      />

      <BlockStack gap="4" className="p-1">
        {type && (
          <BlockStack gap="1">
            <Text size="xs" tone="subdued" weight="semibold">
              Type
            </Text>
            <CopyText size="sm" className="font-mono">
              {type}
            </CopyText>
          </BlockStack>
        )}

        {output.description && (
          <BlockStack gap="1">
            <Text size="xs" tone="subdued" weight="semibold">
              Description
            </Text>
            <CopyText size="sm">{output.description}</CopyText>
          </BlockStack>
        )}
      </BlockStack>
    </BlockStack>
  );
});
