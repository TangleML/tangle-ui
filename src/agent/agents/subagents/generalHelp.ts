import { Agent } from "@openai/agents";

import { config } from "../../config";
import { attachObservabilityHooks } from "../../middleware/observability";
import generalHelpPrompt from "../../prompts/generalHelp.md?raw";
import type { AgentSession } from "../../session";
import { createSearchComponentsTool } from "../../tools/searchComponents";
import { searchDocsTool } from "../../tools/searchDocs";

export function createGeneralHelpAgent(session: AgentSession): Agent {
  const agent = new Agent({
    name: "general-help",
    handoffDescription:
      "Answer general questions about Tangle concepts, features, best practices, " +
      "and product behavior. Not specific to the current pipeline.",
    instructions: generalHelpPrompt,
    tools: [createSearchComponentsTool(session), searchDocsTool],
    model: config.subagentModel,
  });
  attachObservabilityHooks(agent, session.emitStatus);
  return agent;
}
