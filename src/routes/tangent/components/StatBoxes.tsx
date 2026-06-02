import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { useTangentStats } from "@/routes/tangent/hooks/useTangentStats";

interface StatBoxProps {
  label: string;
  value: number | null | undefined;
}

/** Renders an em dash while loading and when a count is zero, never `0`. */
function StatBox({ label, value }: StatBoxProps) {
  const display =
    value === null || value === undefined || value === 0 ? "—" : value;

  return (
    <BlockStack
      gap="1"
      className="flex-1 rounded-lg border border-border bg-background p-4"
    >
      <Text size="2xl" weight="bold">
        {display}
      </Text>
      <Text size="sm" tone="subdued">
        {label}
      </Text>
    </BlockStack>
  );
}

export function StatBoxes() {
  const { data: stats, isPending } = useTangentStats();

  const resolved = isPending ? undefined : stats;

  return (
    <InlineStack gap="4" wrap="nowrap" className="w-full">
      <StatBox label="Members" value={resolved?.members} />
      <StatBox label="Scenarios" value={resolved?.scenarios} />
      <StatBox label="With Results" value={resolved?.withResults} />
    </InlineStack>
  );
}
