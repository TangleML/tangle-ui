import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { candidateHasIssues, type UpgradeCandidate } from "@/routes/v2/pages/Editor/components/UpgradeComponents/types";

import { NavigateToEntityButton } from "./NavigateToEntityButton";

interface UpgradeCandidateRowProps {
  candidate: UpgradeCandidate;
  checked: boolean;
  selected: boolean;
  onCheckedChange: (checked: boolean) => void;
  onSelect: () => void;
}

function truncateDigest(digest: string): string {
  return digest.length > 8 ? digest.substring(0, 8) : digest;
}

function StatusIcon({ hasIssues }: { hasIssues: boolean }) {
  if (hasIssues) {
    return (
      <span className="inline-flex shrink-0">
        <Icon name="TriangleAlert" size="sm" className="text-amber-500" />
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0">
      <Icon name="CircleCheck" size="sm" className="text-green-500" />
    </span>
  );
}

export function UpgradeCandidateRow({
  candidate,
  checked,
  selected,
  onCheckedChange,
  onSelect,
}: UpgradeCandidateRowProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "flex items-start gap-2 px-3 py-1.5 rounded-sm cursor-pointer w-full",
        selected ? "bg-muted" : "hover:bg-muted/50",
      )}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect();
      }}
    >
      <InlineStack gap="2" blockAlign="center" className="shrink-0 pt-0.5">
        <Checkbox
          checked={checked}
          onCheckedChange={(val) => onCheckedChange(val === true)}
          onClick={(e) => e.stopPropagation()}
        />
        <StatusIcon hasIssues={candidateHasIssues(candidate)} />
      </InlineStack>
      <BlockStack className="flex-1 min-w-0 gap-0.5">
        <InlineStack
          gap="1"
          blockAlign="start"
          className="w-full"
          align="space-between"
          wrap="nowrap"
        >
          <Text size="sm" weight="semibold" className="truncate no-wrap">
            {candidate.taskName}
          </Text>
          <NavigateToEntityButton
            entityId={candidate.taskId}
            entityType="task"
          />
        </InlineStack>
        <InlineStack
          gap="1"
          blockAlign="center"
          data-testid="upgrade-candidate-row-digest"
        >
          <Badge variant="secondary" size="sm">
            {truncateDigest(candidate.currentDigest)}
          </Badge>
          <Icon name="ArrowRight" size="xs" className="text-muted-foreground" />
          <Badge variant="secondary" size="sm">
            {truncateDigest(candidate.newComponentRef.digest ?? "")}
          </Badge>
        </InlineStack>
      </BlockStack>
    </div>
  );
}
