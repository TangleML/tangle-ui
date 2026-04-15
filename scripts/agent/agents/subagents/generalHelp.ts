import type { SubAgent } from "deepagents";
import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { createProxyModel } from "../../config";
import { createLoggingMiddleware } from "../../middleware/logging";
import { createObservabilityMiddleware } from "../../middleware/observability";
import { searchDocsTool } from "../../registry/docsSearchService";
import { createSearchComponentsTool } from "../../registry/searchService";
import type { AgentSession } from "../../session";

const __dir =
  typeof __dirname !== "undefined"
    ? __dirname
    : dirname(fileURLToPath(import.meta.url));

const promptPath = resolve(__dir, "../../prompts/generalHelp.md");
const generalHelpPrompt = readFileSync(promptPath, "utf-8");

export function createGeneralHelpSubagent(session: AgentSession): SubAgent {
  return {
    name: "general-help",
    description:
      "Answer general questions about Tangle concepts, features, best practices, " +
      "and product behavior. Not specific to the current pipeline.",
    systemPrompt: generalHelpPrompt,
    tools: [createSearchComponentsTool(session), searchDocsTool],
    model: createProxyModel("claude-haiku-4-5"),
    middleware: [
      createLoggingMiddleware("general-help", session.threadId),
      createObservabilityMiddleware("general-help", session.emitter),
    ],
  };
}
