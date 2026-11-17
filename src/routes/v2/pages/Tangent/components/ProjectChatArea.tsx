import { observer } from "mobx-react-lite";
import type { ReactNode } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { BlockStack } from "@/components/ui/layout";
import { TabStrip } from "@/components/ui/tabs";
import { useAiProviderSettings } from "@/hooks/useAiProviderSettings";
import useToastNotification from "@/hooks/useToastNotification";
import { ProjectSettingsButton } from "@/routes/v2/pages/Tangent/components/ProjectSettingsButton";
import { TangentChatPane } from "@/routes/v2/pages/Tangent/components/TangentChatPane";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import { useChatCommands } from "@/routes/v2/pages/Tangent/hooks/useChatCommands";
import { useChatReferences } from "@/routes/v2/pages/Tangent/hooks/useChatReferences";
import { useRefreshSessionResources } from "@/routes/v2/pages/Tangent/hooks/useRefreshSessionResources";
import { AiProviderSetup } from "@/routes/v2/shared/components/AiChat/components/AiProviderSetup";
import { TANGENT_AI_SETUP } from "@/routes/v2/shared/components/AiChat/components/aiSetupCopy";
import { ChatEntityRevealProvider } from "@/routes/v2/shared/components/AiChat/components/ChatEntityRevealContext";

export const ProjectChatArea = observer(function ProjectChatArea() {
  const store = useTangentProject();
  const notify = useToastNotification();
  const { isConfigured } = useAiProviderSettings();
  const references = useChatReferences(store.projectId);
  const commands = useChatCommands(store.projectId);
  const refreshSessionResources = useRefreshSessionResources();
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
        <EmptyState
          title="No active session"
          description="Choose New chat in the Projects panel to chat with Tangent."
        />
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
        commands={commands}
        onOpenArtifact={(url, title) => store.openArtifactTab(url, title)}
        onSendPrompt={(content) => store.recordSessionPrompt(content)}
        onError={(message) => notify(message, "error")}
        onResourcesChange={() => refreshSessionResources(activeSessionId)}
        headerAction={<ProjectSettingsButton />}
      />
    </ChatEntityRevealProvider>
  );
});

/** Secrets and Connect VS Code need neither a provider nor a session. */
function WithoutChat({ children }: { children: ReactNode }) {
  return (
    <BlockStack className="min-h-0 flex-1">
      <TabStrip trailing={<ProjectSettingsButton />} />
      <div className="min-h-0 w-full flex-1">{children}</div>
    </BlockStack>
  );
}
