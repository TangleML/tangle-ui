import type { SubAgent } from "deepagents";
import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { createProxyModel } from "../../config";
import { createCsomTools } from "../../mcp/csomTools";
import { executionDebugTools } from "../../mcp/executionDebugTools";
import { createLoggingMiddleware } from "../../middleware/logging";
import { createObservabilityMiddleware } from "../../middleware/observability";
import type { AgentSession, RecentPipelineRun } from "../../session";

const __dir =
  typeof __dirname !== "undefined"
    ? __dirname
    : dirname(fileURLToPath(import.meta.url));

const promptPath = resolve(__dir, "../../prompts/debugAssistant.md");
const debugAssistantPrompt = readFileSync(promptPath, "utf-8");

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

export function createDebugAssistantSubagent(session: AgentSession): SubAgent {
  const csom = createCsomTools(session);
  const systemPrompt =
    debugAssistantPrompt + formatRecentRunsContext(session.recentRuns);

  return {
    name: "debug-assistant",
    description:
      "Help users understand why pipeline runs failed. Fetches run data, analyzes " +
      "per-task statuses and error logs, and explains the root cause. Read-only — does not modify the pipeline.",
    systemPrompt,
    tools: [csom.getPipelineState, ...executionDebugTools],
    model: createProxyModel("claude-haiku-4-5"),
    middleware: [
      createLoggingMiddleware("debug-assistant", session.threadId),
      createObservabilityMiddleware("debug-assistant", session.emitter),
    ],
  };
}
