/**
 * Pipeline-repair sub-agent — diagnoses validation issues and broken
 * connections in an existing pipeline and applies fixes through the
 * CSOM tool surface (which proxies to the main-thread MobX spec inside
 * a single undo group).
 */
import { Agent } from "@openai/agents";

import { requireOrchestratorModel } from "../../config";
import { attachObservabilityHooks } from "../../middleware/observability";
import pipelineRepairPrompt from "../../prompts/pipelineRepair.md?raw";
import type { AgentSession } from "../../session";
import { createCsomTools } from "../../tools/csomTools";

export function createPipelineRepairAgent(session: AgentSession): Agent {
  const csom = createCsomTools(session.bridge);
  const agent = new Agent({
    name: "pipeline-repair",
    handoffDescription: `Diagnose and fix validation issues, broken connections, missing inputs, and other 
      structural problems in existing pipelines. Can mutate the pipeline via CSOM tools. 
      Asks the user for input when fixes are ambiguous.`,
    instructions: pipelineRepairPrompt,
    tools: csom.allTools,
    model: requireOrchestratorModel(),
  });
  attachObservabilityHooks(agent, session.emitStatus);
  return agent;
}
