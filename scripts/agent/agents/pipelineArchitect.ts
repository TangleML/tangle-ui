import type { SubAgent } from "deepagents";
import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { createProxyModel } from "../config";
import { createCsomTools } from "../mcp/csomTools";
import { pipelineRunTools } from "../mcp/pipelineRunTools";
import { pythonTestTools } from "../mcp/pythonTestTools";
import { createYamlWrapTools } from "../mcp/yamlWrapTools";
import { createLoggingMiddleware } from "../middleware/logging";
import { createObservabilityMiddleware } from "../middleware/observability";
import { createSearchComponentsTool } from "../registry/searchService";
import type { AgentSession } from "../session";

const __dir =
  typeof __dirname !== "undefined"
    ? __dirname
    : dirname(fileURLToPath(import.meta.url));

const promptPath = resolve(__dir, "../prompts/architect.md");
const architectSystemPrompt = readFileSync(promptPath, "utf-8");

export function createPipelineArchitectSubagent(
  session: AgentSession,
): SubAgent {
  const csom = createCsomTools(session);
  return {
    name: "pipeline-architect",
    description:
      "Build new pipelines or add stages to existing ones. Decomposes user intent into " +
      "pipeline plans, discovers components from the registry, creates new components when needed, " +
      "and assembles the pipeline graph using CSOM tools. Use for constructive tasks like " +
      '"build a CSV dedup pipeline" or "add an output stage".',
    systemPrompt: architectSystemPrompt,
    tools: [
      ...csom.allTools,
      createSearchComponentsTool(session),
      ...pipelineRunTools,
      ...createYamlWrapTools(session),
      ...pythonTestTools,
    ],
    model: createProxyModel("claude-sonnet-4-6"),
    middleware: [
      createLoggingMiddleware("pipeline-architect", session.threadId),
      createObservabilityMiddleware("pipeline-architect", session.emitter),
    ],
  };
}
