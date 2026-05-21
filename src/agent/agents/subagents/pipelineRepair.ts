import { Agent } from "@openai/agents";

import { config } from "../../config";
import { attachObservabilityHooks } from "../../middleware/observability";
import pipelineRepairPrompt from "../../prompts/pipelineRepair.md?raw";
import type { AgentSession } from "../../session";
import { createCsomTools } from "../../tools/csomTools";
import { createSearchComponentsTool } from "../../tools/searchComponents";

export function createPipelineRepairAgent(session: AgentSession): Agent {
  const csom = createCsomTools(session.bridge);
  const agent = new Agent({
    name: "pipeline-repair",
    handoffDescription:
      "Diagnose and fix validation issues, broken connections, missing inputs, and other " +
      "structural problems in existing pipelines. Can mutate the pipeline via CSOM tools. " +
      "Asks the user for input when fixes are ambiguous.",
    instructions: pipelineRepairPrompt,
    tools: [...csom.allTools, createSearchComponentsTool(session)],
    model: config.orchestratorModel,
  });
  attachObservabilityHooks(agent, session.emitStatus);
  return agent;
}
