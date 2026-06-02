/**
 * Per-request session for the in-browser agent.
 *
 */
import type { ProxyClient } from "./config";
import type { StatusCallback } from "./types";

export interface AgentSession {
  threadId: string;
  emitStatus: StatusCallback;
  proxyClient: ProxyClient;
}

export function createSession(params: {
  threadId: string;
  proxyClient: ProxyClient;
  emitStatus?: StatusCallback;
}): AgentSession {
  return {
    threadId: params.threadId,
    emitStatus: params.emitStatus ?? (() => {}),
    proxyClient: params.proxyClient,
  };
}
