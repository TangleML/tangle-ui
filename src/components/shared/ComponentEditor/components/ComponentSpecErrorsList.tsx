import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Heading } from "@/components/ui/typography";

export const ComponentSpecErrorsList = ({
  validationErrors,
}: {
  validationErrors: string[];
}) => {
  if (validationErrors.length === 0) {
    return null;
  }

  return (
    <BlockStack className="p-4 px-8 bg-destructive/10 border border-t-4 border-destructive/30 text-destructive">
      <InlineStack gap="2">
        <Icon
          name="OctagonExclamationPoint"
          size="lg"
          className="text-destructive"
        />
        <Heading level={2} tone="critical" size="lg">
          Invalid component spec
        </Heading>
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
