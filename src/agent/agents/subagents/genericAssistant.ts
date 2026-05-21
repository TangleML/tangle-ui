import { Agent } from "@openai/agents";

import { config } from "../../config";
import { attachObservabilityHooks } from "../../middleware/observability";
import genericAssistantPrompt from "../../prompts/genericAssistant.md?raw";
import type { AgentSession } from "../../session";
import { createCsomTools } from "../../tools/csomTools";
import { createSearchComponentsTool } from "../../tools/searchComponents";

export function createGenericAssistantAgent(session: AgentSession): Agent {
  const csom = createCsomTools(session.bridge);
  const agent = new Agent({
    name: "generic-assistant",
    handoffDescription:
      "Explain what a pipeline does, describe data flow, clarify component behavior, " +
      "and answer questions about the current pipeline state. Read-only — never modifies the pipeline.",
    instructions: genericAssistantPrompt,
    tools: [csom.getPipelineState, createSearchComponentsTool(session)],
    model: config.subagentModel,
  });
  attachObservabilityHooks(agent, session.emitStatus);
  return agent;
}
