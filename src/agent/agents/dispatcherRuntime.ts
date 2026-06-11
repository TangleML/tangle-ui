/**
 * Shared dispatcher runtime for the in-browser AI assistant.
 *
 * Owns the per-thread `MemorySession` map and the `invoke` loop. The
 * concrete dispatcher Agent is built per turn by a page-specific
 * `buildAgent` (Editor vs Run View) because the underlying sub-agents
 * close over the per-turn `AgentSession` (bridge, recent runs, status
 * emitter).
 */
import {
  type Agent,
  type AgentInputItem,
  MemorySession,
  run,
} from "@openai/agents";

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

// Reasoning items can carry provider-side ids (`rs_...`) that are only valid
// for the original Responses API turn. OpenAI-compatible proxies that cannot
// dereference those ids on later turns fail with "Item with id ... not found",
// so strip them from replayed history while keeping the reasoning content.
function stripReasoningItemIds(items: AgentInputItem[]): AgentInputItem[] {
  return items.map((item) => {
    if (item.type !== "reasoning" || !("id" in item)) return item;
    const { id: _id, ...itemWithoutId } = item;
    return itemWithoutId;
  });
}

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
        // `reasoningItemIdPolicy: "omit"` is the primary fix: it stops the SDK
        // from sending reasoning-item ids on outgoing turns. The callback is
        // belt-and-suspenders — it scrubs ids the SDK may have already
        // persisted into replayed session history. Keep both until the SDK
        // guarantees history is sanitized on read.
        reasoningItemIdPolicy: "omit",
        sessionInputCallback: (history, newItems) => [
          ...stripReasoningItemIds(history),
          ...newItems,
        ],
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
