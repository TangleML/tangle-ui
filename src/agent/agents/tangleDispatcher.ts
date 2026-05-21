import { Agent, MemorySession, run } from "@openai/agents";
import { RECOMMENDED_PROMPT_PREFIX } from "@openai/agents-core/extensions";

import { config, ensureProxyConfigured } from "../config";
import { attachObservabilityHooks } from "../middleware/observability";
import dispatcherPrompt from "../prompts/dispatcher.md?raw";
import type { AgentSession } from "../session";
import { createCsomTools } from "../tools/csomTools";
import { createDebugAssistantAgent } from "./subagents/debugAssistant";
import { createGeneralHelpAgent } from "./subagents/generalHelp";
import { createGenericAssistantAgent } from "./subagents/genericAssistant";
import { createPipelineArchitectAgent } from "./subagents/pipelineArchitect";
import { createPipelineRepairAgent } from "./subagents/pipelineRepair";

// Per-thread session memory lives for the lifetime of the worker. Persisting
// across reloads would require a custom Session backed by Dexie — out of
// scope for this migration.
const sessions = new Map<string, MemorySession>();

function getOrCreateSession(threadId: string): MemorySession {
  const existing = sessions.get(threadId);
  if (existing) return existing;
  const created = new MemorySession({ sessionId: threadId });
  sessions.set(threadId, created);
  return created;
}

function createDispatcherAgent(session: AgentSession) {
  const csom = createCsomTools(session.bridge);
  const agent = Agent.create({
    name: "tangle-dispatcher",
    model: config.orchestratorModel,
    instructions: `${RECOMMENDED_PROMPT_PREFIX}\n\n${dispatcherPrompt}`,
    tools: [csom.getPipelineState],
    handoffs: [
      createGenericAssistantAgent(session),
      createPipelineArchitectAgent(session),
      createPipelineRepairAgent(session),
      createDebugAssistantAgent(session),
      createGeneralHelpAgent(session),
    ],
  });
  attachObservabilityHooks(agent, session.emitStatus);
  return agent;
}

export interface DispatcherInvokeParams {
  message: string;
  threadId: string;
  selectedEntityId?: string;
  session: AgentSession;
}

export interface DispatcherInvokeResult {
  answer: string;
  threadId: string;
}

export async function invokeDispatcher(
  params: DispatcherInvokeParams,
): Promise<DispatcherInvokeResult> {
  ensureProxyConfigured();

  const sessionMemory = getOrCreateSession(params.threadId);
  const agent = createDispatcherAgent(params.session);

  let userContent = params.message;
  if (params.selectedEntityId) {
    userContent += `\n\n[Context: The user has entity $id="${params.selectedEntityId}" selected in the editor.]`;
  }

  const result = await run(agent, userContent, { session: sessionMemory });
  const answer =
    typeof result.finalOutput === "string"
      ? result.finalOutput
      : JSON.stringify(result.finalOutput ?? "");

  return { answer, threadId: params.threadId };
}
