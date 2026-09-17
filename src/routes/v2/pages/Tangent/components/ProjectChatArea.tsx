import { observer } from "mobx-react-lite";

import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";
import { TangentChatPane } from "@/routes/v2/pages/Tangent/components/TangentChatPane";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";

export const ProjectChatArea = observer(function ProjectChatArea() {
  const store = useTangentProject();
  const notify = useToastNotification();
  const activeSessionId = store.activeSessionId;

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
    <TangentChatPane
      sessionId={activeSessionId}
      tabs={store.chatTabs}
      activeTab={store.chatActiveTab}
      onTabChange={(value) => store.setChatActiveTab(value)}
      onCloseTab={(id) => store.closeChatTab(id)}
      onOpenArtifact={(url, title) => store.openArtifactTab(url, title)}
      onSendPrompt={(content) => store.recordSessionPrompt(content)}
      onError={(message) => notify(message, "error")}
    />
  );
});
