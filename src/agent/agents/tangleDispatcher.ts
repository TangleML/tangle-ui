/**
 * Top-level dispatcher agent for the in-browser AI assistant.
 *
 * The dispatcher itself does not perform end-user tasks. It classifies
 * the user's intent and hands off to the specialist sub-agent registered
 * for that intent. Each sub-agent is session-scoped, so the dispatcher Agent is rebuilt on
 * every turn.
 */
import { Agent, MemorySession, run } from "@openai/agents";
import { RECOMMENDED_PROMPT_PREFIX } from "@openai/agents-core/extensions";

import { requireOrchestratorModel } from "../config";
import { attachObservabilityHooks } from "../middleware/observability";
import dispatcherPrompt from "../prompts/dispatcher.md?raw";
import type { AgentSession } from "../session";
import { createGeneralHelpAgent } from "./subagents/generalHelp";
import { createPipelineRepairAgent } from "./subagents/pipelineRepair";

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
  dispose(): void;
}

function createDispatcherAgent(session: AgentSession): Agent {
  const agent = Agent.create({
    name: "tangle-dispatcher",
    model: requireOrchestratorModel(),
    instructions: `${RECOMMENDED_PROMPT_PREFIX}\n\n${dispatcherPrompt}`,
    tools: [],
    handoffs: [
      createGeneralHelpAgent(session),
      createPipelineRepairAgent(session),
    ],
  });
  attachObservabilityHooks(agent, session.emitStatus);
  return agent;
}

export function createDispatcher(): TangleDispatcher {
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
      params.session.proxyClient.ensureConfigured(params.token);
      const sessionMemory = getOrCreateSessionMemory(params.threadId);
      const agent = createDispatcherAgent(params.session);
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
