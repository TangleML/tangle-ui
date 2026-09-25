import { observer } from "mobx-react-lite";

import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { useAiProviderSettings } from "@/hooks/useAiProviderSettings";
import useToastNotification from "@/hooks/useToastNotification";
import { AgentTraceButton } from "@/routes/v2/pages/Tangent/components/AgentTraceDialog";
import { TangentChatPane } from "@/routes/v2/pages/Tangent/components/TangentChatPane";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import { AiProviderSetup } from "@/routes/v2/shared/components/AiChat/components/AiProviderSetup";
import { TANGENT_AI_SETUP } from "@/routes/v2/shared/components/AiChat/components/aiSetupCopy";
import { ChatEntityRevealProvider } from "@/routes/v2/shared/components/AiChat/components/ChatEntityRevealContext";

export const ProjectChatArea = observer(function ProjectChatArea() {
  const store = useTangentProject();
  const notify = useToastNotification();
  const { isConfigured } = useAiProviderSettings();
  const activeSessionId = store.activeSessionId;

  // Ahead of the session states: without a provider there is nothing to say to
  // a session, so offering to start one would only make a dead thread.
  if (!isConfigured) {
    return <AiProviderSetup {...TANGENT_AI_SETUP} />;
  }

  if (!activeSessionId) {
    return (
      <BlockStack
        gap="1"
        align="center"
        className="min-h-0 flex-1 justify-center p-6 text-center"
      >
        <Text size="sm" weight="semibold">
          No active session
        </Text>
        <Text size="sm" tone="subdued">
          Start a session from the Sessions panel to chat with Tangent.
        </Text>
      </BlockStack>
    );
  }

  return (
    <ChatEntityRevealProvider
      value={{
        revealEntity: (entityId, label) => {
          store.revealEntity(entityId, label);
        },
      }}
    >
      <TangentChatPane
        sessionId={activeSessionId}
        tabs={store.chatTabs}
        activeTab={store.chatActiveTab}
        onTabChange={(value) => store.setChatActiveTab(value)}
        onCloseTab={(id) => store.closeChatTab(id)}
        onOpenArtifact={(url, title) => store.openArtifactTab(url, title)}
        onSendPrompt={(content) => store.recordSessionPrompt(content)}
        onError={(message) => notify(message, "error")}
        headerAction={<AgentTraceButton />}
      />
    </ChatEntityRevealProvider>
  );
});
