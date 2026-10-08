import { observer } from "mobx-react-lite";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import { useProjectSessions } from "@/routes/v2/pages/Tangent/hooks/useProjectSessions";
import { useAiGate } from "@/routes/v2/shared/components/AiChat/components/useAiGate";
import { sessionLabelsById } from "@/services/projects/sessionLabel";
import { formatRelativeTime } from "@/utils/date";
import { tracking } from "@/utils/tracking";

import { RenameSessionDialog } from "./RenameSessionDialog";

export const SessionsWindowContent = observer(function SessionsWindowContent() {
  const store = useTangentProject();
  const aiGate = useAiGate("New session");
  const { sessions, renameSession } = useProjectSessions(store.projectId);
  const activeSessionId = store.activeSessionId;
  const labels = sessionLabelsById(
    sessions.map((session) => [session.sessionId, session]),
  );
  const labelFor = (sessionId: string) => labels.get(sessionId) ?? "";
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(
    null,
  );
  const renamingSession = sessions.find(
    (session) => session.sessionId === renamingSessionId,
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
            const label = labelFor(session.sessionId);
            return (
              <InlineStack
                key={session.sessionId}
                wrap="nowrap"
                blockAlign="center"
                className={cn(
                  "group w-full rounded-md hover:bg-accent",
                  isActive && "bg-accent",
                )}
              >
                <button
                  type="button"
                  onClick={() => store.selectSession(session.sessionId)}
                  {...tracking("projects.open_session")}
                  className="min-w-0 flex-1 px-2 py-1.5 text-left"
                >
                  <InlineStack gap="2" blockAlign="center">
                    <Icon name="MessageSquare" size="xs" />
                    <Text size="sm" className="min-w-0 flex-1 truncate">
                      {label}
                    </Text>
                  </InlineStack>
                  <Text size="xs" tone="subdued">
                    {formatRelativeTime(session.createdAt)}
                  </Text>
                </button>
                <Button
                  variant="ghost"
                  size="xs"
                  aria-label={`Rename ${label}`}
                  onClick={() => setRenamingSessionId(session.sessionId)}
                  {...tracking("projects.rename_session_open")}
                  className="mr-1 shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
                >
                  <Icon name="Pencil" size="xs" />
                </Button>
              </InlineStack>
            );
          })}
        </BlockStack>
      )}

      <Button
        variant="outline"
        aria-label="New session"
        title={aiGate.title}
        onClick={() => void store.startSession()}
        {...tracking("projects.start_session")}
        disabled={store.isStartingSession || aiGate.disabled}
        className="w-full"
      >
        <Icon name={store.isStartingSession ? "Loader" : "Plus"} size="xs" />
        New session
      </Button>

      {renamingSession && (
        <RenameSessionDialog
          session={renamingSession}
          currentLabel={labelFor(renamingSession.sessionId)}
          onRename={renameSession}
          onClose={() => setRenamingSessionId(null)}
        />
      )}
    </BlockStack>
  );
});
