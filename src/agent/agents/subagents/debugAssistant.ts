/**
 * Debug-assistant sub-agent — diagnoses failed pipeline runs.
 *
 * Read-only by design: the agent inspects pipeline state, run metadata,
 * execution details, container state, and truncated logs. It cannot
 * mutate the spec or submit runs — those capabilities belong to
 * `pipeline-repair`, which the dispatcher orchestrates separately.
 *
 * The session's `recentRuns` are appended to the system prompt at agent
 * creation time (per turn) so the model can resolve "my last run" /
 * "the latest run" without an extra tool call.
 */
import { Agent } from "@openai/agents";

import { getAgentModelConfig } from "../../config";
import { attachObservabilityHooks } from "../../middleware/observability";
import debugAssistantPrompt from "../../prompts/debugAssistant.md?raw";
import type { AgentSession, RecentPipelineRun } from "../../session";
import { createCsomTools } from "../../tools/csomTools";
import { createDebugTools } from "../../tools/debugTools";
import { createRunTools } from "../../tools/runTools";

const RECENT_RUNS_PROMPT_LIMIT = 5;

function formatRecentRunsSection(runs: RecentPipelineRun[]): string {
  if (runs.length === 0) return "## Recent runs\n\nNo recent runs available.";
  const lines = runs.slice(0, RECENT_RUNS_PROMPT_LIMIT).map((run) => {
    const status = run.status ? ` — status: ${run.status}` : "";
    return `- run ${run.id} (root execution ${run.root_execution_id}, created ${run.created_at})${status}`;
  });
  return `## Recent runs\n\n${lines.join("\n")}`;
}

export function createDebugAssistantAgent(session: AgentSession): Agent {
  const csom = createCsomTools(session.bridge);
  const runTools = createRunTools(session.bridge);
  const debugTools = createDebugTools(session.bridge);

  const instructions = `${debugAssistantPrompt}\n\n${formatRecentRunsSection(session.recentRuns)}`;

  const agent = new Agent({
    name: "debug-assistant",
    handoffDescription: `Diagnose failed pipeline runs and explain root causes from execution details and container logs.
      Read-only — cannot edit the pipeline or submit runs. Use for "why did my run fail", "what went wrong with run X",
      "show me the error from the latest run".`,
    instructions,
    tools: [
      csom.getPipelineState,
      runTools.getRunStatus,
      runTools.debugPipelineRun,
      ...debugTools.allTools,
    ],
    ...getAgentModelConfig(session.aiConfig),
  });
  attachObservabilityHooks(agent, session.emitStatus);
  return agent;
}
