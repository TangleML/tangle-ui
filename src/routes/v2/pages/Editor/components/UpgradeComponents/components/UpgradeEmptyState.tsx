import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

export function UpgradeEmptyState() {
  return (
    <BlockStack className="flex-1 items-center justify-center p-6" gap="2">
      <Icon name="CircleCheck" size="lg" className="text-green-500" />
      <Text size="sm" tone="subdued">
        All components are up to date.
      </Text>
    </BlockStack>
  );
}
