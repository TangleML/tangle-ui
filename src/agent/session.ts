/**
 * Per-request session for the in-browser agent.
 */
import type { ProxyClient } from "./config";
import type { ToolBridgeApi } from "./toolBridgeApi";
import type { StatusCallback } from "./types";

export interface AgentSession {
  threadId: string;
  emitStatus: StatusCallback;
  proxyClient: ProxyClient;
  bridge: ToolBridgeApi;
}

export function createSession(params: {
  threadId: string;
  proxyClient: ProxyClient;
  bridge: ToolBridgeApi;
  emitStatus?: StatusCallback;
}): AgentSession {
  return {
    threadId: params.threadId,
    emitStatus: params.emitStatus ?? (() => {}),
    proxyClient: params.proxyClient,
    bridge: params.bridge,
  };
}
