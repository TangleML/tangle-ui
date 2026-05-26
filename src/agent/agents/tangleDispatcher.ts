/**
 * Top-level dispatcher agent for the in-browser AI assistant.
 */
import { Agent, MemorySession, run } from "@openai/agents";

import { ensureProxyConfigured, requireOrchestratorModel } from "../config";
import { attachObservabilityHooks } from "../middleware/observability";
import dispatcherPrompt from "../prompts/dispatcher.md?raw";
import type { AgentSession } from "../session";
import type { StatusCallback } from "../types";

interface DispatcherInvokeParams {
  message: string;
  threadId: string;
  token: string;
  session: AgentSession;
}

interface DispatcherInvokeResult {
  answer: string;
  threadId: string;
}

export interface TangleDispatcher {
  invoke(params: DispatcherInvokeParams): Promise<DispatcherInvokeResult>;
}

export function createDispatcher({
  emitStatus,
}: {
  emitStatus: StatusCallback;
}): TangleDispatcher {
  const sessions = new Map<string, MemorySession>();

  const agent = Agent.create({
    name: "tangle-dispatcher",
    model: requireOrchestratorModel(),
    instructions: dispatcherPrompt,
    tools: [],
    handoffs: [],
  });
  attachObservabilityHooks(agent, emitStatus);

  function getOrCreateSessionMemory(threadId: string): MemorySession {
    const existing = sessions.get(threadId);
    if (existing) return existing;
    const created = new MemorySession({ sessionId: threadId });
    sessions.set(threadId, created);
    return created;
  }

  return {
    async invoke(params) {
      ensureProxyConfigured(params.token);
      const sessionMemory = getOrCreateSessionMemory(params.threadId);
      const result = await run(agent, params.message, {
        session: sessionMemory,
      });
      const answer =
        typeof result.finalOutput === "string"
          ? result.finalOutput
          : JSON.stringify(result.finalOutput ?? "");
      return { answer, threadId: params.threadId };
    },
  };
}
