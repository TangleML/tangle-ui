import { AgentList, AssetList, Chat } from "@tangent/embed-react";

import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import useToastNotification from "@/hooks/useToastNotification";

import { CloseableTabTrigger } from "./CloseableTabTrigger";
import { TangentEditorAgentProvider } from "./TangentEditorAgentProvider";
import { CHAT_TAB_VALUE, useTangentSessionTabs } from "./useTangentSessionTabs";

interface TangentSessionWorkspaceProps {
  sessionId: string;
}

const FORCE_MOUNTED_TAB_PANEL =
  "min-h-0 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col data-[state=inactive]:hidden";

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
        <div className="h-[38%] min-h-32 shrink-0">
          <InlineStack fill wrap="nowrap" blockAlign="stretch" align="start">
            <div className="h-full min-h-0 min-w-0 flex-1">
              <AgentList
                sessionId={sessionId}
                selectedId={selectedAgentId}
                onOpen={openAgent}
                onRemove={closeTab}
              />
            </div>
            <div className="h-full min-h-0 min-w-0 flex-1">
              <AssetList
                sessionId={sessionId}
                selectedId={selectedAssetId}
                onOpen={selectAsset}
              />
            </div>
          </InlineStack>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex h-full min-h-0 flex-col gap-1"
          >
            <TabsList className="max-w-full shrink-0 overflow-x-auto">
              <TabsTrigger value={CHAT_TAB_VALUE}>
                <Icon name="MessageSquare" size="xs" />
                Chat
              </TabsTrigger>
              {tabs.map((tab) => (
                <CloseableTabTrigger
                  key={tab.id}
                  value={tab.id}
                  title={tab.title}
                  onClose={() => closeTab(tab.id)}
                />
              ))}
            </TabsList>
            <TabsContent
              value={CHAT_TAB_VALUE}
              forceMount
              className={FORCE_MOUNTED_TAB_PANEL}
            >
              <Chat
                sessionId={sessionId}
                className="h-full min-h-0"
                style={{ height: "100%" }}
                onOpenArtifact={handleOpenArtifact}
                onError={handleError}
              />
            </TabsContent>
            {tabs.map((tab) => (
              <TabsContent
                key={tab.id}
                value={tab.id}
                forceMount
                className={FORCE_MOUNTED_TAB_PANEL}
              >
                <Chat
                  sessionId={sessionId}
                  agentId={tab.id}
                  className="h-full min-h-0"
                  style={{ height: "100%" }}
                  onOpenArtifact={handleOpenArtifact}
                  onError={handleError}
                />
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </BlockStack>
    </TangentEditorAgentProvider>
  );
}
