import { useQuery, useQueryClient } from "@tanstack/react-query";
import { observer } from "mobx-react-lite";
import { useEffect, useRef } from "react";

import type { RecentPipelineRun } from "@/agent/session";
import type { ToolBridgeApi } from "@/agent/toolBridgeApi";
import { useAuthLocalStorage } from "@/components/shared/Authentication/useAuthLocalStorage";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Text } from "@/components/ui/typography";
import { useAiProviderSettings } from "@/hooks/useAiProviderSettings";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { useBackend } from "@/providers/BackendProvider";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { WindowStickyHeader } from "@/routes/v2/shared/windows/components/WindowStickyHeader";
import { fetchPipelineRuns } from "@/services/pipelineRunService";
import type { PipelineRun } from "@/types/pipelineRun";

import { useAiChatStore } from "./AiChatStoreContext";
import { AiProviderSetup } from "./components/AiProviderSetup";
import { ChatInput } from "./components/ChatInput";
import { ChatMessageList } from "./components/ChatMessageList";
import { createDocumentScopedBridge } from "./toolBridge/documentScopedBridge";
import type { BridgeDeps } from "./toolBridge/utils";
import type { SuggestedPrompt } from "./types";

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
  suggestedPrompts?: SuggestedPrompt[];
  includeRecentRuns?: boolean;
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
  suggestedPrompts,
  includeRecentRuns = true,
}: AiChatContentProps) {
  const aiChat = useAiChatStore();
  const { track } = useAnalytics();
  const { navigation } = useSharedStores();
  const { backendUrl } = useBackend();
  const authStorage = useAuthLocalStorage();
  const queryClient = useQueryClient();

  const { config: aiConfig, isConfigured: isAiConfigured } =
    useAiProviderSettings();

  // Keep each turn's bridge reading the latest backend and auth values
  // while the request is running.
  const backendUrlRef = useRef(backendUrl);
  const authToken = authStorage.getToken();
  const authTokenRef = useRef(authToken);
  useEffect(() => {
    backendUrlRef.current = backendUrl;
  }, [backendUrl]);
  useEffect(() => {
    authTokenRef.current = authToken;
  }, [authToken]);

  const pipelineName = navigation.rootSpec?.name;
  const { data: recentRunsData } = useQuery({
    queryKey: ["pipelineRuns", pipelineName],
    queryFn: async () => {
      if (!pipelineName) return [] as PipelineRun[];
      const res = await fetchPipelineRuns(pipelineName);
      return res?.runs ?? [];
    },
    enabled: includeRecentRuns && !!pipelineName,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const thread = aiChat.activeThread;

  async function handleSend(prompt: string) {
    if (!thread) return;
    const recentRuns =
      includeRecentRuns && recentRunsData
        ? projectRecentRuns(recentRunsData)
        : undefined;

    track("ai_assistant.message.submitted", {
      prompt,
      thread_message_count: thread.messages.length,
    });

    await thread.sendMessage(prompt, {
      createBridge: (signal) =>
        createDocumentScopedBridge(
          createBridge,
          {
            getSpec: () => navigation.rootSpec,
            getActiveSpec: () => navigation.activeSpec,
            getActiveSubgraphPath: () =>
              navigation.navigationPath.slice(1).map((e) => e.displayName),
            getActiveSubgraphTaskId: () => navigation.parentContext?.taskId,
            getBackendUrl: () => backendUrlRef.current,
            getAuthToken: () => authTokenRef.current,
            queryClient,
          },
          signal,
        ),
      aiConfig,
      ...(recentRuns && { recentRuns }),
    });

    const lastMessage = thread.messages[thread.messages.length - 1];
    if (lastMessage?.role === "assistant") {
      track("ai_assistant.response.received", {
        prompt,
        response: lastMessage.content,
        thread_message_count: thread.messages.length,
      });
    }
  }

  if (!isAiConfigured) {
    return <AiProviderSetup />;
  }

  if (!thread) return null;

  const hasMessages = thread.messages.length > 0;
  const threadTitle =
    thread.messages.find((m) => m.role === "user")?.content ?? "New chat";

  return (
    <BlockStack fill>
      {hasMessages && (
        <WindowStickyHeader className="border-b w-full shrink-0">
          <InlineStack gap="2" wrap="nowrap" className="w-full min-w-0 p-2">
            <Text
              size="sm"
              weight="semibold"
              className="min-w-0 flex-1 truncate"
              title={threadTitle}
            >
              {threadTitle}
            </Text>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => aiChat.newThread()}
                  aria-label="New chat"
                >
                  <Icon name="SquarePen" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">New chat</TooltipContent>
            </Tooltip>
          </InlineStack>
        </WindowStickyHeader>
      )}
      <ChatMessageList
        messages={thread.messages}
        thinkingText={thread.thinkingText}
        suggestedPrompts={suggestedPrompts}
        onSelectPrompt={handleSend}
      />
      <ChatInput isPending={thread.isPending} onSubmit={handleSend} />
    </BlockStack>
  );
});
