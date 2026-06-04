import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import type { EntityDiff } from "@/utils/componentSpecDiff";

/**
 * Renders the lost / added / changed entities of an `EntityDiff` as a compact,
 * color-coded list. Shared by the legacy and v2 editors (upgrade flow, replace
 * confirmation, and the edit-component save modal). Only reads `name`, so it
 * accepts a diff of any name-keyed entity.
 */
export function DiffSection({
  label,
  diff,
}: {
  label: string;
  diff: EntityDiff<{ name: string }>;
}) {
  const hasChanges =
    diff.lostEntities.length > 0 ||
    diff.newEntities.length > 0 ||
    diff.changedEntities.length > 0;

  if (!hasChanges) return null;

  return (
    <BlockStack gap="1">
      <Text size="xs" weight="semibold" tone="subdued">
        {label} Changes
      </Text>
      <BlockStack className="gap-0.5">
        {diff.lostEntities.map((e) => (
          <DiffLine
            key={`lost-${e.name}`}
            icon="Minus"
            color="text-red-500"
            label={`Removed: ${e.name}`}
          />
        ))}
        {diff.newEntities.map((e) => (
          <DiffLine
            key={`new-${e.name}`}
            icon="Plus"
            color="text-green-600"
            label={`Added: ${e.name}`}
          />
        ))}
        {diff.changedEntities.map((e) => (
          <DiffLine
            key={`changed-${e.name}`}
            icon="RefreshCw"
            color="text-amber-500"
            label={`Changed: ${e.name}`}
          />
        ))}
      </BlockStack>
    </BlockStack>
  );
}

function DiffLine({
  icon,
  color,
  label,
}: {
  icon: "Minus" | "Plus" | "RefreshCw";
  color: string;
  label: string;
}) {
  return (
    <InlineStack gap="1" blockAlign="start">
      <Icon name={icon} size="xs" className={`${color} mt-0.5 shrink-0`} />
      <Text size="xs">{label}</Text>
    </InlineStack>
  );
}
