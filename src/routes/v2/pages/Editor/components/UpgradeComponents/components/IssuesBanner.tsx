import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

export function IssuesBanner({ count }: { count: number }) {
  return (
    <InlineStack
      gap="1"
      blockAlign="center"
      className="px-2 py-1 bg-amber-50 border border-amber-200 rounded-md dark:bg-amber-500/10 dark:border-amber-500/30"
    >
      <Icon
        name="TriangleAlert"
        size="xs"
        className="text-amber-500 shrink-0"
      />
      <Text size="xs" className="text-amber-700 dark:text-amber-300">
        {count} predicted {count === 1 ? "issue" : "issues"}
      </Text>
    </InlineStack>
  );
}
