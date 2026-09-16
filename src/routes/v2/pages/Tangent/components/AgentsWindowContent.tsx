import { AgentList } from "@tangent/embed-react";

import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";

export function AgentsWindowContent() {
  const { activeSessionId, tabs } = useTangentProject();

  if (!activeSessionId) {
    return (
      <BlockStack gap="1" className="p-2">
        <Text size="xs" tone="subdued">
          Start a session to see its agents.
        </Text>
      </BlockStack>
    );
  }

  return (
    <AgentList
      sessionId={activeSessionId}
      selectedId={tabs.selectedAgentId}
      onOpen={tabs.openAgent}
      onRemove={tabs.closeTab}
    />
  );
}
