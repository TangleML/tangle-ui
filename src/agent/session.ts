/**
 * Per-request session for the in-browser agent.
 */
import type { ProxyClient } from "./config";
import type { SkillsLoader } from "./skills/loader";
import type { ToolBridgeApi } from "./toolBridgeApi";
import type { StatusCallback } from "./types";

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
  recentRuns: RecentPipelineRun[];
}

export function createSession(params: {
  threadId: string;
  proxyClient: ProxyClient;
  bridge: ToolBridgeApi;
  skillsLoader: SkillsLoader;
  emitStatus?: StatusCallback;
  recentRuns?: RecentPipelineRun[];
}): AgentSession {
  return {
    threadId: params.threadId,
    emitStatus: params.emitStatus ?? (() => {}),
    proxyClient: params.proxyClient,
    bridge: params.bridge,
    skillsLoader: params.skillsLoader,
    recentRuns: params.recentRuns ?? [],
  };
}
