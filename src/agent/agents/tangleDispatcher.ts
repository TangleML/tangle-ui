/**
 * Top-level dispatcher agent for the in-browser AI assistant.
 *
 * The dispatcher is the only top-level agent in the system. It owns
 * orchestration: it never edits the spec or fetches runs directly,
 * instead it calls specialist sub-agents that are exposed as *tools*
 * via the `Agent.asTool(...)` adapter. The dispatcher's own LLM loop
 * is what chains those tool calls together for multi-step requests
 * (e.g. "investigate AND fix" needs `ask_debug_assistant` followed by
 * `ask_pipeline_repair`).
 *
 * The dispatcher Agent and its specialist tool wrappers are rebuilt
 * on every turn because the underlying sub-agents close over the
 * per-turn `AgentSession` (bridge, recent runs, status emitter).
 */
import { Agent, MemorySession, run } from "@openai/agents";

import type { AiProviderConfig } from "@/types/aiProvider";

import { getAgentModelConfig } from "../config";
import { attachObservabilityHooks } from "../middleware/observability";
import dispatcherPrompt from "../prompts/dispatcher.md?raw";
import type { AgentSession } from "../session";
import { createDebugAssistantAgent } from "./subagents/debugAssistant";
import { createGeneralHelpAgent } from "./subagents/generalHelp";
import { createPipelineArchitectAgent } from "./subagents/pipelineArchitect";
import { createPipelineRepairAgent } from "./subagents/pipelineRepair";

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

async function createDispatcherAgent(session: AgentSession): Promise<Agent> {
  const generalHelp = createGeneralHelpAgent(session);
  const pipelineRepair = createPipelineRepairAgent(session);
  const pipelineArchitect = await createPipelineArchitectAgent(session);
  const debugAssistant = createDebugAssistantAgent(session);

  const agent = new Agent({
    name: "tangle-dispatcher",
    ...getAgentModelConfig(session.aiConfig),
    instructions: dispatcherPrompt,
    tools: [
      generalHelp.asTool({
        toolName: "ask_general_help",
        toolDescription:
          "Ask the general-help specialist a question about Tangle concepts, features, how things work, best practices, getting started, or documentation lookups. Input: the user's question phrased as a clear, standalone question.",
      }),
      pipelineRepair.asTool({
        toolName: "ask_pipeline_repair",
        toolDescription:
          "Ask the pipeline-repair specialist to inspect, validate, or fix the user's currently-open pipeline, or to apply a specific CSOM mutation directive. Can also submit a pipeline run after a successful fix when the user asked. Input: a clear directive. For open-ended repair use 'Validate and fix the current pipeline.'. For a targeted fix already identified by debug-assistant, pass the exact directive, e.g. 'Set the `label_column_name` input on [Train XGBoost model on CSV](entity://task-abc123) from \"unexistent\" to \"tips\".'. Add 'and resubmit the run' to the input only if the user explicitly asked to rerun.",
      }),
      pipelineArchitect.asTool({
        toolName: "ask_pipeline_architect",
        toolDescription:
          "Ask the pipeline-architect specialist to design or build new pipeline structure — a whole pipeline from scratch, a new stage in an existing pipeline, or a multi-task subgraph. Can mutate the pipeline via CSOM tools and submit a run after a successful build when the user asked. NOT for fixing validation errors or single-task tweaks (use `ask_pipeline_repair`). Input: a clear design directive, e.g. 'Build a pipeline that loads a CSV, trains an XGBoost model on the `tips` column, and exposes the trained model as a pipeline output.'. Add 'and submit the run' to the input only if the user explicitly asked to run.",
      }),
      debugAssistant.asTool({
        toolName: "ask_debug_assistant",
        toolDescription:
          "Ask the debug-assistant specialist to diagnose a failed pipeline run from execution details, container state, and logs. Read-only — cannot edit the spec or submit runs. Input: a clear question, e.g. 'Investigate the latest failed run and identify the root cause and the specific fix needed.' or 'Why did run 12345 fail?'.",
      }),
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
      params.session.proxyClient.ensureConfigured(params.aiConfig);
      const sessionMemory = getOrCreateSessionMemory(params.threadId);
      const agent = await createDispatcherAgent(params.session);
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
