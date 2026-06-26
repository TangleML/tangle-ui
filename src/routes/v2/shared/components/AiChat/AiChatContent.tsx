import { useQuery, useQueryClient } from "@tanstack/react-query";
import { observer } from "mobx-react-lite";
import { useEffect, useRef, useState } from "react";

import type { RecentPipelineRun } from "@/agent/session";
import type { ToolBridgeApi } from "@/agent/toolBridgeApi";
import { useAuthLocalStorage } from "@/components/shared/Authentication/useAuthLocalStorage";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { useAiProviderSettings } from "@/hooks/useAiProviderSettings";
import { useBackend } from "@/providers/BackendProvider";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { fetchPipelineRuns } from "@/services/pipelineRunService";
import type { PipelineRun } from "@/types/pipelineRun";

import { useAiChatStore } from "./AiChatStoreContext";
import { AiProviderSetup } from "./components/AiProviderSetup";
import { ChatInput } from "./components/ChatInput";
import { ChatMessageList } from "./components/ChatMessageList";
import type { BridgeDeps } from "./toolBridge/utils";

const RECENT_RUNS_LIMIT = 5;

/**
 * Deps every consumer can supply from the shared navigation/backend/auth
 * stores. The page-specific bridge factory turns these into a concrete
 * `ToolBridgeApi` (Editor adds spec-mutating CSOM handlers; RunView stays
 * read-only).
 */
type CreateBridge = (deps: BridgeDeps) => ToolBridgeApi;

interface AiChatContentProps {
  createBridge: CreateBridge;
}

function projectRecentRuns(runs: PipelineRun[]): RecentPipelineRun[] {
  return runs.slice(0, RECENT_RUNS_LIMIT).map((run) => ({
    id: run.id,
    root_execution_id: run.root_execution_id,
    created_at: run.created_at,
    pipeline_name: run.pipeline_name,
    status: run.status,
  }));
}

export const AiChatContent = observer(function AiChatContent({
  createBridge,
}: AiChatContentProps) {
  const aiChat = useAiChatStore();
  const { navigation } = useSharedStores();
  const { backendUrl } = useBackend();
  const authStorage = useAuthLocalStorage();
  const queryClient = useQueryClient();

  const { config: aiConfig, isConfigured: isAiConfigured } =
    useAiProviderSettings();

  // Refs keep the bridge closure honest about the latest backend/auth
  // values without rebuilding the bridge. Updated on every render so
  // tool calls always read the most recent configuration.
  const backendUrlRef = useRef(backendUrl);
  const authToken = authStorage.getToken();
  const authTokenRef = useRef(authToken);
  useEffect(() => {
    backendUrlRef.current = backendUrl;
  }, [backendUrl]);
  useEffect(() => {
    authTokenRef.current = authToken;
  }, [authToken]);

  // The bridge closes over the navigation store plus the
  // backend/auth/queryClient deps captured via refs. A single instance
  // per AiChatContent mount is correct: each method call re-reads
  // `navigation.rootSpec`, the active path, and the latest backend
  // values lazily so navigation / backend changes are picked up
  // without rebuilding the bridge.
  const [bridge] = useState(() =>
    createBridge({
      getSpec: () => navigation.rootSpec,
      getActiveSubgraphPath: () =>
        navigation.navigationPath.slice(1).map((e) => e.displayName),
      getBackendUrl: () => backendUrlRef.current,
      getAuthToken: () => authTokenRef.current,
      queryClient,
    }),
  );

  const pipelineName = navigation.rootSpec?.name;
  const { data: recentRunsData } = useQuery({
    queryKey: ["pipelineRuns", pipelineName],
    queryFn: async () => {
      if (!pipelineName) return [] as PipelineRun[];
      const res = await fetchPipelineRuns(pipelineName);
      return res?.runs ?? [];
    },
    enabled: !!pipelineName,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const thread = aiChat.activeThread;

  function handleSend(prompt: string) {
    if (!thread) return;
    const recentRuns = recentRunsData
      ? projectRecentRuns(recentRunsData)
      : undefined;
    thread.sendMessage(prompt, {
      bridge,
      aiConfig,
      ...(recentRuns && { recentRuns }),
    });
  }

  if (!isAiConfigured) {
    return <AiProviderSetup />;
  }

  if (!thread) return null;

  return (
    <BlockStack fill>
      <InlineStack
        className="border-b p-2 w-full"
        align="end"
        blockAlign="center"
      >
        <Button
          size="sm"
          variant="ghost"
          onClick={() => aiChat.newThread()}
          aria-label="New chat"
        >
          <Icon name="SquarePen" />
        </Button>
      </InlineStack>
      <ChatMessageList
        messages={thread.messages}
        thinkingText={thread.thinkingText}
      />
      <ChatInput isPending={thread.isPending} onSubmit={handleSend} />
    </BlockStack>
  );
});
