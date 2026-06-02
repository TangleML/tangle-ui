import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";
import { IdeaTypeChip } from "@/routes/tangent/components/IdeaTypeChip";
import type { ExperimentIdea } from "@/routes/tangent/types";
import { formatRelativeTime } from "@/utils/date";

interface IdeaCardProps {
  idea: ExperimentIdea;
}

const STUB_MESSAGE =
  "This action is not wired up in the Phase 1 prototype yet.";

function BuildStatePill({ idea }: { idea: ExperimentIdea }) {
  if (idea.buildState === "building") {
    return (
      <InlineStack gap="1" blockAlign="center" wrap="nowrap">
        <Spinner size={12} />
        <Badge variant="default" shape="rounded" size="sm">
          Building
        </Badge>
      </InlineStack>
    );
  }
  if (idea.buildState === "built") {
    return (
      <Badge variant="default" shape="rounded" size="sm">
        ✓ Built
      </Badge>
    );
  }
  if (idea.buildState === "failed") {
    return (
      <Badge variant="destructive" shape="rounded" size="sm">
        ⚠ Failed
      </Badge>
    );
  }
  return null;
}

function IdeaActions({ idea }: { idea: ExperimentIdea }) {
  const notify = useToastNotification();
  const stub = () => notify(STUB_MESSAGE, "info");

  if (idea.buildState === "built") {
    return (
      <InlineStack gap="2" wrap="wrap">
        <Button size="xs" variant="outline" onClick={stub}>
          View YAML
        </Button>
        <Button size="xs" variant="outline" onClick={stub}>
          ↗ Send to River
        </Button>
        <Button size="xs" variant="ghost" onClick={stub}>
          ↻ Rebuild
        </Button>
      </InlineStack>
    );
  }
  if (idea.buildState === "unbuilt") {
    return idea.source === "tangent" ? (
      <Button size="xs" variant="outline" onClick={stub}>
        ⚡ Auto build
      </Button>
    ) : (
      <Button size="xs" variant="outline" onClick={stub}>
        ▶ Run
      </Button>
    );
  }
  if (idea.buildState === "failed") {
    return (
      <Button size="xs" variant="outline" onClick={stub}>
        ↻ Retry
      </Button>
    );
  }
  return null;
}

function IdeaVotes({ idea }: { idea: ExperimentIdea }) {
  const notify = useToastNotification();
  if (idea.source !== "tangent") return null;
  const stub = () => notify(STUB_MESSAGE, "info");
  return (
    <InlineStack gap="2" wrap="nowrap">
      <Button size="xs" variant="ghost" onClick={stub}>
        👍 {idea.upvotes ? idea.upvotes : ""}
      </Button>
      <Button size="xs" variant="ghost" onClick={stub}>
        👎 {idea.downvotes ? idea.downvotes : ""}
      </Button>
    </InlineStack>
  );
}

export function IdeaCard({ idea }: IdeaCardProps) {
  return (
    <BlockStack
      gap="3"
      className="rounded-lg border border-border bg-background p-4"
    >
      <InlineStack gap="3" blockAlign="start" align="space-between" wrap="wrap">
        <BlockStack gap="2" className="min-w-0 flex-1">
          <InlineStack gap="2" blockAlign="center" wrap="wrap">
            <Badge
              variant={idea.source === "tangent" ? "secondary" : "outline"}
              shape="rounded"
              size="sm"
            >
              {idea.source === "tangent" ? "Tangent" : "Human"}
            </Badge>
            <IdeaTypeChip type={idea.type} />
            {idea.impact && (
              <Text size="xs" tone="subdued">
                Impact: {idea.impact}
              </Text>
            )}
            <BuildStatePill idea={idea} />
          </InlineStack>
          <Text size="sm" weight="semibold">
            {idea.title}
          </Text>
          <Text size="sm" tone="subdued">
            {idea.evidence}
          </Text>
          {idea.author && (
            <Text size="xs" tone="subdued">
              by {idea.author}
            </Text>
          )}
          {idea.buildState === "built" && idea.builtBy && (
            <InlineStack gap="2" blockAlign="center" wrap="wrap">
              <Text
                size="xs"
                className="text-emerald-600 dark:text-emerald-400"
              >
                ✓ Built by {idea.builtBy}
                {idea.builtAt
                  ? ` · ${formatRelativeTime(new Date(idea.builtAt))}`
                  : ""}
              </Text>
              {idea.unverifiedCount ? (
                <Text size="xs" tone="critical">
                  {idea.unverifiedCount} UNVERIFIED
                </Text>
              ) : null}
            </InlineStack>
          )}
        </BlockStack>
        <IdeaVotes idea={idea} />
      </InlineStack>
      <IdeaActions idea={idea} />
    </BlockStack>
  );
}
