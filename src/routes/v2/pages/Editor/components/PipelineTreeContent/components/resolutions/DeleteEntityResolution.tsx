import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import type { ValidationIssue } from "@/models/componentSpec";

export function DeleteEntityResolution({
  issue,
  label,
  onDelete,
}: {
  issue: ValidationIssue;
  label: string;
  onDelete: () => void;
}) {
  return (
    <BlockStack gap="2">
      <Text size="xs" tone="subdued">
        This issue can be resolved by removing the entity.
      </Text>
      <Button
        variant="destructive"
        size="sm"
        onClick={onDelete}
        disabled={!issue.entityId}
      >
        <Icon name="Trash2" size="xs" />
        {label}
      </Button>
    </BlockStack>
  );
}
