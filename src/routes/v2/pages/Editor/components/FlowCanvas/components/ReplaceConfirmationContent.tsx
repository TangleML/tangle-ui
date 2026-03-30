import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import type { InputSpec } from "@/models/componentSpec";
import type { OutputSpec } from "@/models/componentSpec/entities/types";
import { DiffSection } from "@/routes/v2/pages/Editor/components/UpgradeComponents/components/UpgradeCandidateDetail";
import type { EntityDiff } from "@/routes/v2/pages/Editor/store/actions/task.utils";

interface ReplaceConfirmationContentProps {
  taskName: string;
  newComponentName: string;
  inputDiff: EntityDiff<InputSpec>;
  outputDiff: EntityDiff<OutputSpec>;
}

export function ReplaceConfirmationContent({
  taskName,
  newComponentName,
  inputDiff,
  outputDiff,
}: ReplaceConfirmationContentProps) {
  const hasBreakingChanges =
    inputDiff.lostEntities.length > 0 || outputDiff.lostEntities.length > 0;

  return (
    <BlockStack gap="3" className="py-2">
      <InlineStack gap="1" blockAlign="center">
        <Text size="sm">
          Replace <Text weight="semibold">{taskName}</Text> with{" "}
          <Text weight="semibold">{newComponentName}</Text>
        </Text>
      </InlineStack>

      {hasBreakingChanges && (
        <InlineStack gap="1" blockAlign="center">
          <Icon name="TriangleAlert" size="sm" className="text-amber-500" />
          <Text size="xs" tone="subdued">
            Some inputs or outputs will be removed, and their connections will
            be lost.
          </Text>
        </InlineStack>
      )}

      <DiffSection label="Input" diff={inputDiff} />
      <DiffSection label="Output" diff={outputDiff} />
    </BlockStack>
  );
}
