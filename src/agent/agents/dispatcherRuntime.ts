/**
 * Shared dispatcher runtime for the in-browser AI assistant.
 *
 * Owns the per-thread `MemorySession` map and the `invoke` loop. The
 * concrete dispatcher Agent is built per turn by a page-specific
 * `buildAgent` (Editor vs Run View) because the underlying sub-agents
 * close over the per-turn `AgentSession` (bridge, recent runs, status
 * emitter).
 */
import { type Agent, MemorySession, run } from "@openai/agents";

import type { AiProviderConfig } from "@/types/aiProvider";

import type { AgentSession } from "../session";

interface DispatcherInvokeParams {
  message: string;
  threadId: string;
  aiConfig: AiProviderConfig;
  session: AgentSession;
}

interface DispatcherInvokeResult {
  answer: string;
  threadId: string;
}

export interface TangleDispatcher {
  invoke(params: DispatcherInvokeParams): Promise<DispatcherInvokeResult>;
  dispose(): void;
}

export type BuildDispatcherAgent = (session: AgentSession) => Promise<Agent>;

export function createDispatcherRuntime(
  buildAgent: BuildDispatcherAgent,
): TangleDispatcher {
  const sessions = new Map<string, MemorySession>();

  function getOrCreateSessionMemory(threadId: string): MemorySession {
    const existing = sessions.get(threadId);
    if (existing) return existing;
    const created = new MemorySession({ sessionId: threadId });
    sessions.set(threadId, created);
    return created;
  }

  return {
    async invoke(params) {
      params.session.proxyClient.ensureConfigured(params.aiConfig);
      const sessionMemory = getOrCreateSessionMemory(params.threadId);
      const agent = await buildAgent(params.session);
      const result = await run(agent, params.message, {
        session: sessionMemory,
      });
      const answer =
        typeof result.finalOutput === "string"
          ? result.finalOutput
          : JSON.stringify(result.finalOutput ?? "");
      return { answer, threadId: params.threadId };
    },
    dispose() {
      sessions.clear();
    },
  };
}
