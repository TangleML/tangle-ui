import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";

interface UpgradeFooterProps {
  selectedCount: number;
  onUpgrade: () => void;
  onCancel: () => void;
}

export function UpgradeFooter({
  selectedCount,
  onUpgrade,
  onCancel,
}: UpgradeFooterProps) {
  return (
    <InlineStack
      align="end"
      blockAlign="center"
      className="px-3 py-2 shrink-0 w-full"
    >
      <Button variant="ghost" size="sm" onClick={onCancel}>
        Cancel
      </Button>
      <Button
        size="sm"
        onClick={onUpgrade}
        disabled={selectedCount === 0}
        variant="default"
      >
        <Icon name="CircleArrowUp" size="sm" />
        Upgrade{selectedCount > 0 ? ` (${selectedCount})` : ""}
      </Button>
    </InlineStack>
  );
}
