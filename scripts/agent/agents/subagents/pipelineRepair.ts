import type { SubAgent } from "deepagents";
import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { createProxyModel } from "../../config";
import { createCsomTools } from "../../mcp/csomTools";
import { createLoggingMiddleware } from "../../middleware/logging";
import { createObservabilityMiddleware } from "../../middleware/observability";
import { createSearchComponentsTool } from "../../registry/searchService";
import type { AgentSession } from "../../session";

const __dir =
  typeof __dirname !== "undefined"
    ? __dirname
    : dirname(fileURLToPath(import.meta.url));

const promptPath = resolve(__dir, "../../prompts/pipelineRepair.md");
const pipelineRepairPrompt = readFileSync(promptPath, "utf-8");

export function createPipelineRepairSubagent(session: AgentSession): SubAgent {
  const csom = createCsomTools(session);
  return {
    name: "pipeline-repair",
    description:
      "Diagnose and fix validation issues, broken connections, missing inputs, and other " +
      "structural problems in existing pipelines. Can mutate the pipeline via CSOM tools. " +
      "Asks the user for input when fixes are ambiguous.",
    systemPrompt: pipelineRepairPrompt,
    tools: [...csom.allTools, createSearchComponentsTool(session)],
    model: createProxyModel("claude-sonnet-4-6"),
    middleware: [
      createLoggingMiddleware("pipeline-repair", session.threadId),
      createObservabilityMiddleware("pipeline-repair", session.emitter),
    ],
  };
}
