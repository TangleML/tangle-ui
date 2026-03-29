import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import type { ValidationIssue } from "@/models/componentSpec";
import type {
  InputSpec,
  OutputSpec,
} from "@/models/componentSpec/entities/types";
import { candidateHasIssues, type UpgradeCandidate } from "@/routes/v2/pages/Editor/components/UpgradeComponents/types";
import type { EntityDiff } from "@/routes/v2/pages/Editor/store/actions/task.utils";

function truncateDigest(digest: string): string {
  return digest.length > 8 ? digest.substring(0, 8) : digest;
}

function EmptyDetail() {
  return (
    <BlockStack className="flex-1 items-center justify-center p-4" gap="1">
      <Icon
        name="MousePointerClick"
        size="md"
        className="text-muted-foreground"
      />
      <Text size="xs" tone="subdued">
        Select a component to see details
      </Text>
    </BlockStack>
  );
}

function DiffSection<T extends InputSpec | OutputSpec>({
  label,
  diff,
}: {
  label: string;
  diff: EntityDiff<T>;
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

function PredictedIssuesSection({ issues }: { issues: ValidationIssue[] }) {
  if (issues.length === 0) return null;

  return (
    <BlockStack gap="1">
      <Text size="xs" weight="semibold" tone="subdued">
        Predicted Issues
      </Text>
      <BlockStack className="gap-0.5">
        {issues.map((issue, index) => {
          const isError = issue.severity === "error";
          const iconName = isError ? "CircleAlert" : "TriangleAlert";
          const color = isError ? "text-red-500" : "text-amber-500";

          return (
            <InlineStack
              key={`${issue.issueCode}-${index}`}
              gap="1"
              blockAlign="start"
              wrap="nowrap"
            >
              <Icon
                name={iconName}
                size="xs"
                className={`${color} mt-0.5 shrink-0`}
              />
              <Text size="xs">{issue.message}</Text>
            </InlineStack>
          );
        })}
      </BlockStack>
    </BlockStack>
  );
}

export function UpgradeCandidateDetail({
  candidate,
}: {
  candidate: UpgradeCandidate | undefined;
}) {
  if (!candidate) return <EmptyDetail />;

  const hasIssues = candidateHasIssues(candidate);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <BlockStack className="p-3" gap="3">
        <BlockStack gap="1">
          <InlineStack gap="1" blockAlign="center">
            <Text size="sm" weight="semibold" className="min-w-0 truncate">
              {candidate.taskName}
            </Text>
          </InlineStack>
          <InlineStack gap="1" blockAlign="center">
            <Badge variant="secondary" size="sm">
              {truncateDigest(candidate.currentDigest)}
            </Badge>
            <Icon
              name="ArrowRight"
              size="xs"
              className="text-muted-foreground"
            />
            <Badge variant="default" size="sm">
              {truncateDigest(candidate.newComponentRef.digest ?? "")}
            </Badge>
          </InlineStack>
        </BlockStack>

        {candidate.newComponentRef.url && (
          <BlockStack className="gap-0.5">
            <Text size="xs" weight="semibold" tone="subdued">
              Source
            </Text>
            <Text size="xs" className="break-all">
              {candidate.newComponentRef.url}
            </Text>
          </BlockStack>
        )}

        <BlockStack gap="1">
          <Text size="xs" weight="semibold" tone="subdued">
            Status
          </Text>
          {hasIssues ? (
            <InlineStack gap="1" blockAlign="center">
              <Icon name="TriangleAlert" size="sm" className="text-amber-500" />
              <Text size="xs">
                {candidate.predictedIssues.length} issue
                {candidate.predictedIssues.length !== 1 ? "s" : ""} detected
              </Text>
            </InlineStack>
          ) : (
            <InlineStack gap="1" blockAlign="center">
              <Icon name="CircleCheck" size="sm" className="text-green-500" />
              <Text size="xs">No issues — safe to upgrade</Text>
            </InlineStack>
          )}
        </BlockStack>

        <DiffSection label="Input" diff={candidate.inputDiff} />
        <DiffSection label="Output" diff={candidate.outputDiff} />
        <PredictedIssuesSection issues={candidate.predictedIssues} />
      </BlockStack>
    </div>
  );
}
