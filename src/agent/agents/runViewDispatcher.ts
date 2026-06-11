/**
 * Run View dispatcher agent for the in-browser AI assistant.
 *
 * Read-only by design: the Run View worker inspects a completed (or
 * running) pipeline run, so the dispatcher only exposes the non-mutating
 * specialists — `ask_general_help` and `ask_debug_assistant`. The active
 * run is baked into the instructions from `session.context` so the agent
 * is immediately aware of which run it works with, without an extra tool
 * call or the user restating the run id.
 *
 * The dispatcher Agent and its specialist tool wrappers are rebuilt on
 * every turn because the underlying sub-agents close over the per-turn
 * `AgentSession` (bridge, recent runs, status emitter).
 */
import { Agent } from "@openai/agents";

import { getAgentModelConfig } from "../config";
import { attachObservabilityHooks } from "../middleware/observability";
import runViewDispatcherPrompt from "../prompts/runViewDispatcher.md?raw";
import type { AgentSession } from "../session";
import type { AgentContext } from "../types";
import {
  createDispatcherRuntime,
  type TangleDispatcher,
} from "./dispatcherRuntime";
import { createDebugAssistantAgent } from "./subagents/debugAssistant";
import { createGeneralHelpAgent } from "./subagents/generalHelp";
import { createTangentResearcherAgent } from "./subagents/tangentResearcher";

function formatCurrentRunSection(context: AgentContext): string {
  if (context.mode !== "runView") {
    return "## Current run\n\nNo run context available.";
  }
  const subgraph = context.subgraphExecutionId
    ? `\n- subgraph execution: ${context.subgraphExecutionId}`
    : "";
  return `## Current run\n\nThe user is viewing run ${context.runId}. Treat this as "the current run" / "this run" unless they name a different run id.${subgraph}`;
}

async function buildRunViewAgent(session: AgentSession): Promise<Agent> {
  const generalHelp = createGeneralHelpAgent(session);
  const debugAssistant = createDebugAssistantAgent(session);
  const tangentResearcher = createTangentResearcherAgent(session);

  const instructions = `${runViewDispatcherPrompt}\n\n${formatCurrentRunSection(session.context)}`;

  const agent = new Agent({
    name: "tangle-run-view-dispatcher",
    ...getAgentModelConfig(session.aiConfig),
    instructions,
    tools: [
      generalHelp.asTool({
        toolName: "ask_general_help",
        toolDescription:
          "Ask the general-help specialist a question about Tangle concepts, features, how things work, best practices, getting started, or documentation lookups. Input: the user's question phrased as a clear, standalone question.",
      }),
      debugAssistant.asTool({
        toolName: "ask_debug_assistant",
        toolDescription:
          "Ask the debug-assistant specialist to inspect or explain a pipeline run from execution details, container state, and logs. Read-only — cannot edit the spec or submit runs. Input: a clear question that names the run id, e.g. 'Explain what run 12345 did and its outcome.' or 'Why did run 12345 fail?'.",
      }),
      tangentResearcher.asTool({
        toolName: "create_optimization_scenario",
        toolDescription:
          "Ask the Tangent Researcher to analyze the current run for ML optimization potential and produce a 0-100 score plus prioritized hyperparameter-tuning and experiment ideas. Read-only. Input must name the run id, e.g. 'Analyze run 12345 for optimization opportunities.'.",
      }),
    ],
  });
  attachObservabilityHooks(agent, session.emitStatus);
  return agent;
}

export function createRunViewDispatcher(): TangleDispatcher {
  return createDispatcherRuntime(buildRunViewAgent);
}
