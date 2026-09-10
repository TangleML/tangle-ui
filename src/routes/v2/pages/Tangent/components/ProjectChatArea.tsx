import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import { ChatEntityRevealProvider } from "@/routes/v2/shared/components/AiChat/components/ChatEntityRevealContext";
import {
  SharedStoreProvider,
  useSharedStores,
} from "@/routes/v2/shared/store/SharedStoreContext";
import { TangentChatPane } from "@/routes/v2/shared/tangent/TangentChatPane";

export function ProjectChatArea() {
  const {
    activeSessionId,
    tabs,
    onOpenArtifact,
    onError,
    activeTabStore,
    revealEntity,
  } = useTangentProject();
  const pageStore = useSharedStores();

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

  const chatPane = (
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

  // Always re-provide a store so the chat's entity/component chips navigate and
  // focus the active pipeline canvas. Rendering the provider unconditionally
  // (swapping the `store` value rather than adding/removing the wrapper) keeps
  // the chat mounted, so when a pipeline tab registers its store later the
  // already-rendered `observer` chips reactively re-resolve in place instead of
  // remounting the whole chat. Falls back to the page-level store (no open
  // pipeline), where chips render inertly.
  return (
    <SharedStoreProvider store={activeTabStore ?? pageStore}>
      <ChatEntityRevealProvider
        value={{
          revealEntity: (entityId, label) => {
            void revealEntity(entityId, label);
          },
        }}
      >
        {chatPane}
      </ChatEntityRevealProvider>
    </SharedStoreProvider>
  );
}
