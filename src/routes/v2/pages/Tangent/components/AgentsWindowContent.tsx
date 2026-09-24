import { AgentList } from "@tangent/embed-react";
import { observer } from "mobx-react-lite";

import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";

import { AgentTraceButton } from "./AgentTraceDialog";

export const AgentsWindowContent = observer(function AgentsWindowContent() {
  const store = useTangentProject();
  const activeSessionId = store.activeSessionId;

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
    <BlockStack gap="1">
      <AgentList
        sessionId={activeSessionId}
        selectedId={store.selectedAgentId}
        onOpen={(agent) => store.openAgent(agent)}
        onRemove={(id) => store.closeChatTab(id)}
      />
      <AgentTraceButton />
    </BlockStack>
  );
});
