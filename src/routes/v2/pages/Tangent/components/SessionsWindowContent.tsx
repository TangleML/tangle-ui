import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import { formatRelativeTime } from "@/utils/date";

export function SessionsWindowContent() {
  const {
    sessions,
    activeSessionId,
    selectSession,
    startSession,
    isStartingSession,
  } = useTangentProject();

  return (
    <BlockStack gap="2" className="p-2">
      <InlineStack align="space-between" blockAlign="center">
        <Text size="xs" weight="semibold" tone="subdued">
          Sessions
        </Text>
        <Button
          variant="ghost"
          size="min"
          aria-label="New session"
          title="New session"
          onClick={startSession}
          disabled={isStartingSession}
        >
          <Icon name={isStartingSession ? "Loader" : "Plus"} size="xs" />
        </Button>
      </InlineStack>

      {sessions.length === 0 ? (
        <Text size="xs" tone="subdued">
          No sessions yet.
        </Text>
      ) : (
        <BlockStack gap="1">
          {sessions.map((session, index) => {
            const isActive = session.id === activeSessionId;
            const label =
              session.openingPrompt?.split("\n")[0]?.trim() ||
              `Session ${index + 1}`;
            return (
              <button
                key={session.id}
                type="button"
                onClick={() => selectSession(session.id)}
                className={cn(
                  "w-full rounded-md px-2 py-1.5 text-left hover:bg-accent",
                  isActive && "bg-accent",
                )}
              >
                <InlineStack gap="2" blockAlign="center">
                  <Icon name="MessageSquare" size="xs" />
                  <Text size="sm" className="min-w-0 flex-1 truncate">
                    {label}
                  </Text>
                </InlineStack>
                <Text size="xs" tone="subdued">
                  {formatRelativeTime(new Date(session.createdAt)) ?? ""}
                </Text>
              </button>
            );
          })}
        </BlockStack>
      )}
    </BlockStack>
  );
}
