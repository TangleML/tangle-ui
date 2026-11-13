import { observer } from "mobx-react-lite";
import type { ReactNode } from "react";

import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { useAiProviderSettings } from "@/hooks/useAiProviderSettings";
import useToastNotification from "@/hooks/useToastNotification";
import { ProjectSettingsButton } from "@/routes/v2/pages/Tangent/components/ProjectSettingsButton";
import { TangentChatPane } from "@/routes/v2/pages/Tangent/components/TangentChatPane";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import { useChatReferences } from "@/routes/v2/pages/Tangent/hooks/useChatReferences";
import { AiProviderSetup } from "@/routes/v2/shared/components/AiChat/components/AiProviderSetup";
import { TANGENT_AI_SETUP } from "@/routes/v2/shared/components/AiChat/components/aiSetupCopy";
import { ChatEntityRevealProvider } from "@/routes/v2/shared/components/AiChat/components/ChatEntityRevealContext";

export const ProjectChatArea = observer(function ProjectChatArea() {
  const store = useTangentProject();
  const notify = useToastNotification();
  const { isConfigured } = useAiProviderSettings();
  const references = useChatReferences(store.projectId);
  const activeSessionId = store.activeSessionId;

  // Ahead of the session states: without a provider there is nothing to say to
  // a session, so offering to start one would only make a dead thread.
  if (!isConfigured) {
    return (
      <WithoutChat>
        <AiProviderSetup {...TANGENT_AI_SETUP} />
      </WithoutChat>
    );
  }

  if (!activeSessionId) {
    return (
      <WithoutChat>
        <BlockStack
          gap="1"
          align="center"
          className="h-full justify-center p-6 text-center"
        >
          <Text size="sm" weight="semibold">
            No active session
          </Text>
          <Text size="sm" tone="subdued">
            Choose New chat in the Projects panel to chat with Tangent.
          </Text>
        </BlockStack>
      </WithoutChat>
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
        onOpenAgent={(agent) => store.openAgent(agent)}
        onRemoveAgent={(id) => store.closeChatTab(id)}
        references={references}
        onOpenArtifact={(url, title) => store.openArtifactTab(url, title)}
        onSendPrompt={(content) => store.recordSessionPrompt(content)}
        onError={(message) => notify(message, "error")}
        headerAction={<ProjectSettingsButton />}
      />
    </ChatEntityRevealProvider>
  );
});

/** Secrets and Connect VS Code need neither a provider nor a session. */
function WithoutChat({ children }: { children: ReactNode }) {
  return (
    <BlockStack className="min-h-0 flex-1">
      <InlineStack
        align="end"
        className="h-10 w-full shrink-0 px-2 shadow-[inset_0_-1px_0_var(--border)]"
      >
        <ProjectSettingsButton />
      </InlineStack>
      <div className="min-h-0 w-full flex-1">{children}</div>
    </BlockStack>
  );
}
