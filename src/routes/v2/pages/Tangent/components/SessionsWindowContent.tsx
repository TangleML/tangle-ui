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
      {sessions.length === 0 ? (
        <Text size="xs" tone="subdued">
          No sessions yet.
        </Text>
      ) : (
        <BlockStack gap="1">
          {sessions.map((session, index) => {
            const isActive = session.sessionId === activeSessionId;
            const label = `Session ${sessions.length - index}`;
            return (
              <button
                key={session.sessionId}
                type="button"
                onClick={() => selectSession(session.sessionId)}
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
                  {formatRelativeTime(session.createdAt) ?? ""}
                </Text>
              </button>
            );
          })}
        </BlockStack>
      )}

      <Button
        variant="outline"
        aria-label="New session"
        title="New session"
        onClick={startSession}
        disabled={isStartingSession}
        className="w-full"
      >
        <Icon name={isStartingSession ? "Loader" : "Plus"} size="xs" />
        New session
      </Button>
    </BlockStack>
  );
}
