import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

export const ComponentSpecErrorsList = ({
  validationErrors,
}: {
  validationErrors: string[];
}) => {
  if (validationErrors.length === 0) {
    return null;
  }

  return (
    <BlockStack className="p-4 px-8 bg-red-100 border border-t-4 border-red-300 text-destructive">
      <InlineStack gap="2">
        <Icon name="OctagonAlert" size="lg" className="text-destructive" />
        <Text tone="critical" as="h2" size="lg">
          Invalid component spec
        </Text>
      </InlineStack>
      <ul className="list-disc list-inside space-y-1 p-4">
        {validationErrors.map((error, idx) => (
          <li key={`${idx}-${error}`} className="text-sm">
            {error}
          </li>
        ))}
      </ul>
    </BlockStack>
  );
};
