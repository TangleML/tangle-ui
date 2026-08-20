import { AgentList, AssetList } from "@tangent/embed-react";

import { BlockStack, InlineStack } from "@/components/ui/layout";
import useToastNotification from "@/hooks/useToastNotification";
import { TangentChatPane } from "@/routes/v2/shared/tangent/TangentChatPane";
import { useTangentSessionTabs } from "@/routes/v2/shared/tangent/useTangentSessionTabs";

import { TangentEditorAgentProvider } from "./TangentEditorAgentProvider";

interface TangentSessionWorkspaceProps {
  sessionId: string;
}

export function TangentSessionWorkspace({
  sessionId,
}: TangentSessionWorkspaceProps) {
  const notify = useToastNotification();
  const {
    tabs,
    activeTab,
    selectedAgentId,
    selectedAssetId,
    openAgent,
    closeTab,
    selectAsset,
    setActiveTab,
  } = useTangentSessionTabs();

  function handleOpenArtifact(url: string) {
    window.open(url, "_blank", "noopener");
  }

  function handleError(message: string) {
    notify(message, "error");
  }

  return (
    <TangentEditorAgentProvider sessionId={sessionId}>
      <BlockStack fill align="stretch" inlineAlign="start">
        <InlineStack
          fill
          wrap="nowrap"
          blockAlign="start"
          align="start"
          className="min-h-0 flex-1 "
        >
          <BlockStack align="stretch" inlineAlign="start" className="w-[200px]">
            <AgentList
              sessionId={sessionId}
              selectedId={selectedAgentId}
              onOpen={openAgent}
              onRemove={closeTab}
            />

            <AssetList
              sessionId={sessionId}
              selectedId={selectedAssetId}
              onOpen={selectAsset}
            />
          </BlockStack>
          <TangentChatPane
            sessionId={sessionId}
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onCloseTab={closeTab}
            onOpenArtifact={handleOpenArtifact}
            onError={handleError}
          />
        </InlineStack>
      </BlockStack>
    </TangentEditorAgentProvider>
  );
}
