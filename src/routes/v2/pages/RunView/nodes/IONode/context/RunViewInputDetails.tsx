import { observer } from "mobx-react-lite";

import { LinkNodeButton } from "@/components/shared/Buttons/LinkNodeButton";
import { ActionBlock } from "@/components/shared/ContextPanel/Blocks/ActionBlock";
import { CopyText } from "@/components/shared/CopyText/CopyText";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";

interface RunViewInputDetailsProps {
  entityId: string;
}

export const RunViewInputDetails = observer(function RunViewInputDetails({
  entityId,
}: RunViewInputDetailsProps) {
  const spec = useSpec();
  const input = spec?.inputs.find((i) => i.$id === entityId);

  if (!input) {
    return (
      <BlockStack className="p-4">
        <Text size="sm" tone="subdued">
          Input not found
        </Text>
      </BlockStack>
    );
  }

  const type = input.type ? String(input.type) : undefined;

  return (
    <BlockStack
      gap="4"
      className="h-full px-2"
      data-context-panel="input-overview"
    >
      <InlineStack gap="2" blockAlign="center">
        <Icon name="Download" size="sm" className="text-blue-500 shrink-0" />
        <CopyText size="lg" className="font-semibold wrap-anywhere">
          {input.name}
        </CopyText>
      </InlineStack>

      <ActionBlock
        actions={[<LinkNodeButton key="link" nodeId={input.name} />]}
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

        {input.description && (
          <BlockStack gap="1">
            <Text size="xs" tone="subdued" weight="semibold">
              Description
            </Text>
            <CopyText size="sm">{input.description}</CopyText>
          </BlockStack>
        )}

        {input.defaultValue && (
          <BlockStack gap="1">
            <Text size="xs" tone="subdued" weight="semibold">
              Default Value
            </Text>
            <CopyText size="sm" className="font-mono whitespace-pre-wrap">
              {input.defaultValue}
            </CopyText>
          </BlockStack>
        )}

        <InlineStack gap="2" blockAlign="center">
          <Text size="xs" tone="subdued" weight="semibold">
            Optional:
          </Text>
          <CopyText size="xs" className="font-semibold">
            {input.optional ? "Yes" : "No"}
          </CopyText>
        </InlineStack>
      </BlockStack>
    </BlockStack>
  );
});
