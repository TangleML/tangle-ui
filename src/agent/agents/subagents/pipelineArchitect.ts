import { Agent } from "@openai/agents";

import { config } from "../../config";
import { attachObservabilityHooks } from "../../middleware/observability";
import architectPrompt from "../../prompts/architect.md?raw";
import type { AgentSession } from "../../session";
import { createCsomTools } from "../../tools/csomTools";
import { pipelineRunTools } from "../../tools/runTools";
import { createSearchComponentsTool } from "../../tools/searchComponents";

export function createPipelineArchitectAgent(session: AgentSession): Agent {
  const csom = createCsomTools(session.bridge);
  const agent = new Agent({
    name: "pipeline-architect",
    handoffDescription:
      "Build new pipelines or add stages to existing ones. Assembles registry " +
      "components into a graph using CSOM tools. Use for constructive tasks like " +
      '"build a CSV dedup pipeline" or "add an output stage". Cannot create custom Python components.',
    instructions: architectPrompt,
    tools: [
      ...csom.allTools,
      createSearchComponentsTool(session),
      ...pipelineRunTools,
    ],
    model: config.orchestratorModel,
  });
  attachObservabilityHooks(agent, session.emitStatus);
  return agent;
}
