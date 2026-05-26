/**
 * Per-request session for the in-browser agent.
 */

export interface AgentSession {
  threadId: string;
}

export function createSession(params: { threadId: string }): AgentSession {
  return {
    threadId: params.threadId,
  };
}
