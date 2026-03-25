import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

interface UpgradeHeaderProps {
  total: number;
  issueCount: number;
  selectedCount: number;
  allChecked: boolean;
  someChecked: boolean;
  onToggleAll: () => void;
}

export function UpgradeHeader({
  total,
  issueCount,
  selectedCount,
  allChecked,
  someChecked,
  onToggleAll,
}: UpgradeHeaderProps) {
  return (
    <BlockStack className="px-3 pt-3 pb-2 shrink-0" gap="1">
      <InlineStack blockAlign="center" gap="2">
        <Text size="sm" weight="semibold">
          {total} component{total !== 1 ? "s" : ""} can be upgraded
        </Text>
        {issueCount > 0 && (
          <InlineStack gap="1" blockAlign="center">
            <Icon name="TriangleAlert" size="xs" className="text-amber-500" />
            <Text size="xs" tone="subdued">
              {issueCount} with issues
            </Text>
          </InlineStack>
        )}
      </InlineStack>
      <InlineStack gap="2" blockAlign="center">
        <Checkbox
          checked={allChecked ? true : someChecked ? "indeterminate" : false}
          onCheckedChange={onToggleAll}
        />
        <Text size="xs" tone="subdued">
          {selectedCount} of {total} selected
        </Text>
      </InlineStack>
    </BlockStack>
  );
}
