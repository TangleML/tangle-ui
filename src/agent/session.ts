/**
 * Per-request session for the in-browser agent.
 */
import type { AiProviderConfig } from "@/types/aiProvider";

import type { ProxyClient } from "./config";
import type { SkillsLoader } from "./skills/loader";
import type { ToolBridgeApi } from "./toolBridgeApi";
import type { AgentContext, StatusCallback } from "./types";

export interface RecentPipelineRun {
  id: number;
  root_execution_id: number;
  created_at: string;
  pipeline_name: string;
  status?: string;
}

export interface AgentSession {
  threadId: string;
  emitStatus: StatusCallback;
  proxyClient: ProxyClient;
  bridge: ToolBridgeApi;
  skillsLoader: SkillsLoader;
  aiConfig: AiProviderConfig;
  recentRuns: RecentPipelineRun[];
  context: AgentContext;
}

export function createSession(params: {
  threadId: string;
  proxyClient: ProxyClient;
  bridge: ToolBridgeApi;
  skillsLoader: SkillsLoader;
  context: AgentContext;
  aiConfig: AiProviderConfig;
  emitStatus?: StatusCallback;
  recentRuns?: RecentPipelineRun[];
}): AgentSession {
  return {
    threadId: params.threadId,
    emitStatus: params.emitStatus ?? (() => {}),
    proxyClient: params.proxyClient,
    bridge: params.bridge,
    skillsLoader: params.skillsLoader,
    aiConfig: params.aiConfig,
    recentRuns: params.recentRuns ?? [],
    context: params.context,
  };
}
