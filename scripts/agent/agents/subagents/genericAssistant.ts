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

const promptPath = resolve(__dir, "../../prompts/genericAssistant.md");
const genericAssistantPrompt = readFileSync(promptPath, "utf-8");

export function createGenericAssistantSubagent(
  session: AgentSession,
): SubAgent {
  const csom = createCsomTools(session);
  return {
    name: "generic-assistant",
    description:
      "Explain what a pipeline does, describe data flow, clarify component behavior, " +
      "and answer questions about the current pipeline state. Read-only — never modifies the pipeline.",
    systemPrompt: genericAssistantPrompt,
    tools: [csom.getPipelineState, createSearchComponentsTool(session)],
    model: createProxyModel("claude-haiku-4-5"),
    middleware: [
      createLoggingMiddleware("generic-assistant", session.threadId),
      createObservabilityMiddleware("generic-assistant", session.emitter),
    ],
  };
}
