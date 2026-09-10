import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import { TangentChatPane } from "@/routes/v2/shared/tangent/TangentChatPane";

export function ProjectChatArea() {
  const { activeSessionId, tabs, onOpenArtifact, onError } =
    useTangentProject();

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
      tabs={tabs.tabs}
      activeTab={tabs.activeTab}
      onTabChange={tabs.setActiveTab}
      onCloseTab={tabs.closeTab}
      onOpenArtifact={onOpenArtifact}
      onError={onError}
    />
  );
}
