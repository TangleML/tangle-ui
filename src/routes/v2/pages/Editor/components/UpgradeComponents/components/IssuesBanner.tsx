import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

export function IssuesBanner({ count }: { count: number }) {
  return (
    <InlineStack
      gap="1"
      blockAlign="center"
      className="px-2 py-1 bg-amber-50 border border-amber-200 rounded-md"
    >
      <Icon name="TriangleAlert" size="xs" tone="warning" />
      <Text size="xs" tone="warning">
        {count} predicted {count === 1 ? "issue" : "issues"}
      </Text>
    </InlineStack>
  );
}
