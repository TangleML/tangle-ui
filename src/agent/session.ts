/**
 * Per-request session for the in-browser agent.
 *
 * Unlike the server-side AgentSession this does NOT own a ComponentSpec —
 * the live MobX spec stays on the main thread and is mutated through the
 * tool bridge. The session here only carries thread metadata, the tool
 * bridge proxy, the status callback, and a map of component references
 * surfaced by search_components for chip rendering.
 */
import type { ToolBridgeApi } from "./toolBridgeApi";
import type { ComponentRefData } from "./types";

export interface RecentPipelineRun {
  id: string;
  root_execution_id: string;
  created_at: string;
  created_by: string;
  pipeline_name: string;
  status?: string;
}

export type StatusCallback = (status: { text: string }) => void;

export interface AgentSession {
  threadId: string;
  bridge: ToolBridgeApi;
  emitStatus: StatusCallback;
  recentRuns: RecentPipelineRun[];
  componentReferences: Map<string, ComponentRefData>;
}

export function createSession(params: {
  threadId: string;
  bridge: ToolBridgeApi;
  emitStatus?: StatusCallback;
  recentRuns?: RecentPipelineRun[];
}): AgentSession {
  return {
    threadId: params.threadId,
    bridge: params.bridge,
    emitStatus: params.emitStatus ?? (() => {}),
    recentRuns: params.recentRuns ?? [],
    componentReferences: new Map(),
  };
}

export function recordComponentReference(
  session: AgentSession,
  ref: ComponentRefData,
): void {
  session.componentReferences.set(ref.id, ref);
}
