import { DiffSection } from "@/components/shared/ComponentDiff/DiffSection";
import { TrimmedDigest } from "@/components/shared/ManageComponent/TrimmedDigest";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import type { EntityDiff } from "@/utils/componentSpecDiff";

interface ComponentEditSummaryProps {
  /** Digest of the component currently on the task. */
  currentDigest?: string;
  /** Digest of the edited component being applied. */
  newDigest?: string;
  inputDiff: EntityDiff<{ name: string }>;
  outputDiff: EntityDiff<{ name: string }>;
  /**
   * When false, the lost/new/changed `DiffSection`s are omitted (the digest
   * transition + breaking warning still show). Used where a richer preview
   * renders the per-port diff instead. Defaults to true.
   */
  showDiffList?: boolean;
}

/**
 * Summarizes what an edited component changes, in the same visual language as
 * the component-upgrade / replace flows: a current → new digest transition, a
 * breaking-change warning when inputs/outputs are removed, and the shared
 * lost/new/changed `DiffSection`s. Shared by the legacy and v2 save modals.
 */
export function ComponentEditSummary({
  currentDigest,
  newDigest,
  inputDiff,
  outputDiff,
  showDiffList = true,
}: ComponentEditSummaryProps) {
  const hasBreakingChanges =
    inputDiff.lostEntities.length > 0 || outputDiff.lostEntities.length > 0;
  const showDigests =
    !!currentDigest && !!newDigest && currentDigest !== newDigest;

  return (
    <BlockStack gap="3">
      {showDigests && (
        <InlineStack gap="1" blockAlign="center" wrap="nowrap">
          <TrimmedDigest
            digest={currentDigest}
            className="text-muted-foreground"
          />
          <Icon
            name="ArrowRight"
            size="xs"
            className="shrink-0 text-muted-foreground"
          />
          <TrimmedDigest digest={newDigest} />
        </InlineStack>
      )}

      {hasBreakingChanges && (
        <InlineStack gap="1" blockAlign="center" wrap="nowrap">
          <Icon
            name="TriangleAlert"
            size="sm"
            className="shrink-0 text-amber-500"
          />
          <Text size="xs" tone="subdued">
            Some inputs or outputs will be removed, and their connections will
            be lost.
          </Text>
        </InlineStack>
      )}

      {showDiffList && (
        <>
          <DiffSection label="Input" diff={inputDiff} />
          <DiffSection label="Output" diff={outputDiff} />
        </>
      )}
    </BlockStack>
  );
}
