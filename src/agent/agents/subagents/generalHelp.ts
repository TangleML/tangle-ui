/**
 * General-help sub-agent — answers Tangle / docs / concept / best-practices
 * questions by running the in-browser `search_docs` RAG tool and citing
 * the matching documentation page back to the user.
 */
import { Agent } from "@openai/agents";

import { requireSubagentModel } from "../../config";
import { attachObservabilityHooks } from "../../middleware/observability";
import generalHelpPrompt from "../../prompts/generalHelp.md?raw";
import type { AgentSession } from "../../session";
import { createSearchDocsTool } from "../../tools/searchDocs";

export function createGeneralHelpAgent(session: AgentSession): Agent {
  const agent = new Agent({
    name: "general-help",
    handoffDescription: `Answer general questions about Tangle concepts, features, best practices, 
      and product behavior. Not specific to the current pipeline.`,
    instructions: generalHelpPrompt,
    tools: [createSearchDocsTool(session.proxyClient)],
    model: requireSubagentModel(),
  });
  attachObservabilityHooks(agent, session.emitStatus);
  return agent;
}
