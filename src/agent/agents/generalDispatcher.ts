/**
 * General dashboard dispatcher for the global Sidekick.
 *
 * It reuses the same General Help specialist as the Editor assistant for
 * Tangle concept/docs answers, plus read-only component, pipeline, and run
 * tools for pages that provide context.
 */
import { Agent } from "@openai/agents";

import { getAgentModelConfig } from "../config";
import { attachObservabilityHooks } from "../middleware/observability";
import type { AgentSession } from "../session";
import { createComponentSearchTools } from "../tools/componentSearchTools";
import { createCsomTools } from "../tools/csomTools";
import { createDebugTools } from "../tools/debugTools";
import { createRunTools } from "../tools/runTools";
import type { AgentContext } from "../types";
import {
  createDispatcherRuntime,
  type TangleDispatcher,
} from "./dispatcherRuntime";
import { createGeneralHelpAgent } from "./subagents/generalHelp";

const generalDispatcherPrompt = `# Tangle Sidekick Dispatcher

You are the Tangle Sidekick, the global AI assistant for Tangle.

Your job is to answer questions about Tangle concepts, product behavior, best practices, getting started, and the current pipeline/run when context is available.

## Available specialist tools

| Tool | When to call it |
| --- | --- |
| get_pipeline_state | Any question about the currently-open pipeline, what it does, its tasks, inputs, outputs, or connections. |
| search_components | Any request to find, list, compare, choose, or look up available components by intent or keywords. Return matching components as component page links. |
| get_run_status | Any question about the current or named run status. |
| debug_pipeline_run | Any question about why a run failed or what went wrong. |
| get_execution_details / get_execution_state / get_container_state / get_container_log | Follow-up run/debug questions after you know the relevant execution id. |
| ask_general_help | Any question about Tangle concepts, features, how things work, best practices, getting started, or documentation lookups. |

## Returning tool output

When the specialist returns, relay its response to the user essentially as-is. Preserve markdown links exactly. When search_components returns, list the strongest matches using the componentPageLink values exactly as returned. Add at most one short reason per component.

## Limitations

You cannot edit, fix, build, submit, or rerun the user's current pipeline from global Sidekick. If the user asks for mutations, explain that those actions happen in the pipeline editor and offer read-only guidance instead.

## Style

Be brief and natural. For off-topic questions, say: "I'm the Tangle Sidekick — I can help with Tangle concepts and how to use the product. That question is outside what I can help with today."`;

function formatCurrentContextSection(context: AgentContext): string {
  if (context.mode !== "general")
    return "## Current context\n\nGlobal Sidekick.";
  const runContext = context.runId
    ? `\nThe user is viewing run ${context.runId}. Treat this as "the current run" / "this run" unless they name a different run id.`
    : "";
  return `## Current context\n\nGlobal Sidekick can inspect the current pipeline when one is open.${runContext}`;
}

async function buildGeneralAgent(session: AgentSession): Promise<Agent> {
  const generalHelp = createGeneralHelpAgent(session);
  const componentSearch = createComponentSearchTools(session);
  const csom = createCsomTools(session.bridge);
  const runTools = createRunTools(session.bridge);
  const debugTools = createDebugTools(session.bridge);

  const agent = new Agent({
    name: "tangle-sidekick-dispatcher",
    ...getAgentModelConfig(session.aiConfig),
    instructions: `${generalDispatcherPrompt}\n\n${formatCurrentContextSection(session.context)}`,
    tools: [
      csom.getPipelineState,
      componentSearch.searchComponents,
      runTools.getRunStatus,
      runTools.debugPipelineRun,
      ...debugTools.allTools,
      generalHelp.asTool({
        toolName: "ask_general_help",
        toolDescription:
          "Ask the general-help specialist a question about Tangle concepts, features, how things work, best practices, getting started, or documentation lookups. Input: the user's question phrased as a clear, standalone question.",
      }),
    ],
  });
  attachObservabilityHooks(agent, session.emitStatus);
  return agent;
}

export function createGeneralDispatcher(): TangleDispatcher {
  return createDispatcherRuntime(buildGeneralAgent);
}
