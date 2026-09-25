import { observer } from "mobx-react-lite";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { useAiProviderSettings } from "@/hooks/useAiProviderSettings";
import { cn } from "@/lib/utils";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import { useProjectSessions } from "@/routes/v2/pages/Tangent/hooks/useProjectSessions";
import { TANGENT_AI_REQUIRED } from "@/routes/v2/shared/components/AiChat/components/aiSetupCopy";
import { sessionLabelsById } from "@/services/projects/sessionLabel";
import { formatRelativeTime } from "@/utils/date";

export const SessionsWindowContent = observer(function SessionsWindowContent() {
  const store = useTangentProject();
  const { isConfigured: isAiConfigured } = useAiProviderSettings();
  const { sessions } = useProjectSessions(store.projectId);
  const activeSessionId = store.activeSessionId;
  const labels = sessionLabelsById(
    sessions.map((session) => [session.sessionId, session]),
  );

  return (
    <BlockStack gap="2" className="p-2">
      {sessions.length === 0 ? (
        <Text size="xs" tone="subdued">
          No sessions yet.
        </Text>
      ) : (
        <BlockStack gap="1">
          {sessions.map((session) => {
            const isActive = session.sessionId === activeSessionId;
            const label = labels.get(session.sessionId) ?? "Session";
            return (
              <button
                key={session.sessionId}
                type="button"
                onClick={() => store.selectSession(session.sessionId)}
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
        title={isAiConfigured ? "New session" : TANGENT_AI_REQUIRED}
        onClick={() => void store.startSession()}
        disabled={store.isStartingSession || !isAiConfigured}
        className="w-full"
      >
        <Icon name={store.isStartingSession ? "Loader" : "Plus"} size="xs" />
        New session
      </Button>
    </BlockStack>
  );
});
