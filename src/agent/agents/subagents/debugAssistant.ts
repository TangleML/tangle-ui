import { Agent } from "@openai/agents";

import { config } from "../../config";
import { attachObservabilityHooks } from "../../middleware/observability";
import debugAssistantPrompt from "../../prompts/debugAssistant.md?raw";
import type { AgentSession, RecentPipelineRun } from "../../session";
import { createCsomTools } from "../../tools/csomTools";
import { executionDebugTools } from "../../tools/debugTools";

function formatRecentRunsContext(runs: RecentPipelineRun[]): string {
  if (runs.length === 0) return "";

  const lines = runs.map(
    (r) =>
      `- Run ${r.id} | status: ${r.status ?? "unknown"} | root_exec: ${r.root_execution_id} | by: ${r.created_by} | ${r.created_at}`,
  );
  return (
    "\n\n## Recent Pipeline Runs (from the frontend)\n\n" +
    lines.join("\n") +
    "\n\nUse these run IDs and root_execution_ids directly — no need to ask the user for them."
  );
}

export function createDebugAssistantAgent(session: AgentSession): Agent {
  const csom = createCsomTools(session.bridge);
  const instructions =
    debugAssistantPrompt + formatRecentRunsContext(session.recentRuns);

  const agent = new Agent({
    name: "debug-assistant",
    handoffDescription:
      "Help users understand why pipeline runs failed. Fetches run data, analyzes " +
      "per-task statuses and error logs, and explains the root cause. Read-only — does not modify the pipeline.",
    instructions,
    tools: [csom.getPipelineState, ...executionDebugTools],
    model: config.subagentModel,
  });
  attachObservabilityHooks(agent, session.emitStatus);
  return agent;
}
