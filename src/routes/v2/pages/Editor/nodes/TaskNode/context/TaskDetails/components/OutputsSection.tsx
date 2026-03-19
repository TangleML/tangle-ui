import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import type { ComponentSpecJson } from "@/models/componentSpec";

interface OutputsSectionProps {
  componentSpec: ComponentSpecJson | undefined;
}

export function OutputsSection({ componentSpec }: OutputsSectionProps) {
  if (!componentSpec?.outputs || componentSpec.outputs.length === 0) {
    return (
      <Text size="xs" tone="subdued">
        No outputs defined
      </Text>
    );
  }

  return (
    <BlockStack gap="1">
      {componentSpec.outputs.map((output) => (
        <InlineStack
          key={output.name}
          gap="2"
          className="text-xs py-1 px-2 bg-gray-50 rounded border border-gray-100"
        >
          <Text size="xs" weight="semibold" className="text-gray-700">
            {output.name}
          </Text>
          {output.type && (
            <Text size="xs" className="text-gray-500">
              : {String(output.type)}
            </Text>
          )}
        </InlineStack>
      ))}
    </BlockStack>
  );
}
