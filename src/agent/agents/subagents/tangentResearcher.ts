/**
 * Tangent Researcher sub-agent — scores a pipeline run for ML
 * optimization potential and proposes prioritized tuning/experiment
 * ideas.
 *
 * Read-only by design: it inspects run metadata and (optionally) the
 * pipeline spec, but has no CSOM mutation or run-submission tools. Runs
 * with high reasoning effort because scoring optimization potential is a
 * judgment-heavy task.
 *
 * The session's `recentRuns` are appended to the system prompt at agent
 * creation time (per turn) so the model can resolve "this run" / "the
 * latest run" without an extra tool call.
 */
import { Agent } from "@openai/agents";

import { getAgentModelConfig } from "../../config";
import { attachObservabilityHooks } from "../../middleware/observability";
import tangentResearcherPrompt from "../../prompts/tangentResearcher.md?raw";
import type { AgentSession, RecentPipelineRun } from "../../session";
import { createCsomTools } from "../../tools/csomTools";
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

export function createTangentResearcherAgent(session: AgentSession): Agent {
  const csom = createCsomTools(session.bridge);
  const runTools = createRunTools(session.bridge);

  const instructions = `${tangentResearcherPrompt}\n\n${formatRecentRunsSection(session.recentRuns)}`;

  const agent = new Agent({
    name: "tangent-researcher",
    handoffDescription: `Score a pipeline run 0-100 for ML optimization potential and propose prioritized
      hyperparameter-tuning and experiment ideas. Read-only — cannot edit the pipeline or submit runs.`,
    instructions,
    tools: [runTools.getRunStatus, csom.getPipelineState],
    ...getAgentModelConfig(session.aiConfig),
    modelSettings: { reasoning: { effort: "high" } },
  });
  attachObservabilityHooks(agent, session.emitStatus);
  return agent;
}
