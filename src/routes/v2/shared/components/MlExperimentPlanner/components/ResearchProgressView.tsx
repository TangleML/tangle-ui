import { Badge } from "@/components/ui/badge";
import { Icon, type IconName } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";
import type {
  ResearchPhase,
  ResearchProgress,
  ResearchTodoStatus,
} from "@/routes/tangent/services/autoresearchOpencode";

type BadgeVariant = "default" | "secondary" | "outline" | "destructive";

const PHASE_LABEL: Record<ResearchPhase, string> = {
  starting: "Starting",
  working: "Working",
  retrying: "Retrying",
  completed: "Completed",
  failed: "Failed",
};

const PHASE_VARIANT: Record<ResearchPhase, BadgeVariant> = {
  starting: "secondary",
  working: "default",
  retrying: "secondary",
  completed: "default",
  failed: "destructive",
};

function isActivePhase(phase: ResearchPhase): boolean {
  return phase === "starting" || phase === "working" || phase === "retrying";
}

const TODO_ICON: Record<ResearchTodoStatus, IconName> = {
  pending: "Circle",
  in_progress: "CircleDot",
  completed: "CircleCheck",
  cancelled: "CircleX",
};

function TodoItem({
  content,
  status,
}: {
  content: string;
  status: ResearchTodoStatus;
}) {
  const isDone = status === "completed" || status === "cancelled";
  return (
    <InlineStack gap="2" blockAlign="start" wrap="nowrap">
      <Icon
        name={TODO_ICON[status]}
        size="sm"
        className="mt-0.5 shrink-0 text-muted-foreground"
      />
      <Text
        as="span"
        size="xs"
        tone={isDone ? "subdued" : "inherit"}
        className={status === "cancelled" ? "line-through" : undefined}
      >
        {content}
      </Text>
    </InlineStack>
  );
}

interface ResearchProgressViewProps {
  progress?: ResearchProgress;
  isLoading: boolean;
  isError: boolean;
}

export function ResearchProgressView({
  progress,
  isLoading,
  isError,
}: ResearchProgressViewProps) {
  if (isError) {
    return (
      <Text as="p" size="xs" tone="critical">
        Couldn&apos;t load research progress.
      </Text>
    );
  }

  if (!progress) {
    return (
      <InlineStack gap="2" blockAlign="center">
        <Spinner size={14} />
        <Text as="span" size="xs" tone="subdued">
          Loading progress…
        </Text>
      </InlineStack>
    );
  }

  const { phase } = progress;
  const detail = progress.currentTool ?? progress.latestText;

  return (
    <BlockStack gap="2">
      <InlineStack gap="2" blockAlign="center">
        <Badge variant={PHASE_VARIANT[phase]} size="sm" shape="rounded">
          {PHASE_LABEL[phase]}
        </Badge>
        {isActivePhase(phase) && <Spinner size={14} />}
        {isLoading && !isActivePhase(phase) && <Spinner size={14} />}
      </InlineStack>

      {phase === "failed" && progress.error && (
        <Text as="p" size="xs" tone="critical">
          {progress.error}
        </Text>
      )}

      {detail && (
        <Text as="p" size="xs" tone="subdued" className="line-clamp-2">
          {detail}
        </Text>
      )}

      {progress.todos.length > 0 && (
        <BlockStack gap="1">
          {progress.todos.map((todo) => (
            <TodoItem key={todo.id} content={todo.content} status={todo.status} />
          ))}
        </BlockStack>
      )}
    </BlockStack>
  );
}
