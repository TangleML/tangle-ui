import { useQuery, useQueryClient } from "@tanstack/react-query";
import { observer } from "mobx-react-lite";
import { useEffect, useRef, useState } from "react";

import { getAiToken } from "@/agent/aiTokenStore";
import { config } from "@/agent/config";
import type { RecentPipelineRun } from "@/agent/session";
import { useAuthLocalStorage } from "@/components/shared/Authentication/useAuthLocalStorage";
import { BlockStack } from "@/components/ui/layout";
import useToastNotification from "@/hooks/useToastNotification";
import { useBackend } from "@/providers/BackendProvider";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { fetchPipelineRuns } from "@/services/pipelineRunService";
import type { PipelineRun } from "@/types/pipelineRun";

import { useAiChatStore } from "./AiChatStoreContext";
import { AiTokenSetup } from "./components/AiTokenSetup";
import { ChatInput } from "./components/ChatInput";
import { ChatMessageList } from "./components/ChatMessageList";
import { createToolBridge } from "./toolBridge";
import { AiAssistantTokenQueryKeys } from "./types";

const RECENT_RUNS_LIMIT = 5;

function projectRecentRuns(runs: PipelineRun[]): RecentPipelineRun[] {
  return runs.slice(0, RECENT_RUNS_LIMIT).map((run) => ({
    id: run.id,
    root_execution_id: run.root_execution_id,
    created_at: run.created_at,
    pipeline_name: run.pipeline_name,
    status: run.status,
  }));
}

export const AiChatContent = observer(function AiChatContent() {
  const aiChat = useAiChatStore();
  const notify = useToastNotification();
  const { navigation } = useSharedStores();
  const editorSession = useEditorSession();
  const { backendUrl } = useBackend();
  const authStorage = useAuthLocalStorage();
  const queryClient = useQueryClient();

  const { data: token, isPending: isTokenLoading } = useQuery({
    queryKey: AiAssistantTokenQueryKeys.Token(),
    queryFn: getAiToken,
    staleTime: Infinity,
  });

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

  // The bridge closes over the navigation + undo stores plus the
  // backend/auth/queryClient deps captured via refs. A single instance
  // per AiChatContent mount is correct: each method call re-reads
  // `navigation.rootSpec`, the active path, and the latest backend
  // values lazily so navigation / backend changes are picked up
  // without rebuilding the bridge.
  const [bridge] = useState(() =>
    createToolBridge({
      getSpec: () => navigation.rootSpec,
      getActiveSubgraphPath: () =>
        navigation.navigationPath.slice(1).map((e) => e.displayName),
      undo: editorSession.undo,
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

  function handleSend(prompt: string) {
    const recentRuns = recentRunsData
      ? projectRecentRuns(recentRunsData)
      : undefined;
    aiChat.sendMessage(prompt, {
      onError: (msg) => notify(msg, "error"),
      bridge,
      ...(recentRuns && { recentRuns }),
    });
  }

  if (isTokenLoading) return null;

  const needsToken = token == null && config.proxyMode === "browser-direct";
  if (needsToken) {
    return <AiTokenSetup />;
  }

  return (
    <BlockStack fill>
      <ChatMessageList
        messages={aiChat.messages}
        thinkingText={aiChat.thinkingText}
      />
      <ChatInput isPending={aiChat.isPending} onSubmit={handleSend} />
    </BlockStack>
  );
});
