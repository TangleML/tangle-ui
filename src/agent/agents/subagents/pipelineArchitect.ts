/**
 * Pipeline-architect sub-agent — designs and builds new pipelines (or
 * new stages within an existing pipeline) from a high-level user goal,
 * applying edits through the CSOM tool surface inside an undo group.
 *
 * Skill content is awaited at agent-construction time via
 * `session.skillsLoader.getSkill(id)`. The worker warms the loader at
 * `init` (fire-and-forget) so by the time a turn starts the underlying
 * promises are usually already resolved.
 */
import { Agent } from "@openai/agents";

import { requireOrchestratorModel } from "../../config";
import { attachObservabilityHooks } from "../../middleware/observability";
import architectPrompt from "../../prompts/architect.md?raw";
import type { AgentSession } from "../../session";
import { createCsomTools } from "../../tools/csomTools";
import { createRunTools } from "../../tools/runTools";

const REFERENCE_SKILL_IDS = [
  "tangleBestPractices",
  "componentYamlFormat",
] as const;

async function buildInstructions(session: AgentSession): Promise<string> {
  const sections = (
    await Promise.all(
      REFERENCE_SKILL_IDS.map((id) => session.skillsLoader.getSkill(id)),
    )
  ).filter((content) => content.length > 0);
  if (sections.length === 0) return architectPrompt;
  return `${architectPrompt}\n\n## Reference skills\n\n${sections.join("\n\n---\n\n")}`;
}

export async function createPipelineArchitectAgent(
  session: AgentSession,
): Promise<Agent> {
  const csom = createCsomTools(session.bridge);
  const runTools = createRunTools(session.bridge);
  const agent = new Agent({
    name: "pipeline-architect",
    handoffDescription: `Design and build new pipelines (or new stages within an existing
      pipeline) from a high-level goal. Can mutate the pipeline via CSOM tools and submit a run
      after a successful build when the user asks. Asks the user for input when design choices
      are ambiguous.`,
    instructions: await buildInstructions(session),
    tools: [...csom.allTools, runTools.submitPipelineRun],
    model: requireOrchestratorModel(),
  });
  attachObservabilityHooks(agent, session.emitStatus);
  return agent;
}
