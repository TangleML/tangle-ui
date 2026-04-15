import { MemorySaver } from "@langchain/langgraph";
import { createDeepAgent } from "deepagents";
import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { createProxyModel } from "../config";
import { createCsomTools } from "../mcp/csomTools";
import {
  createLoggingMiddleware,
  writeExecutionSummary,
} from "../middleware/logging";
import { createObservabilityMiddleware } from "../middleware/observability";
import type { AgentSession } from "../session";
import { createPipelineArchitectSubagent } from "./pipelineArchitect";
import { createDebugAssistantSubagent } from "./subagents/debugAssistant";
import { createGeneralHelpSubagent } from "./subagents/generalHelp";
import { createGenericAssistantSubagent } from "./subagents/genericAssistant";
import { createPipelineRepairSubagent } from "./subagents/pipelineRepair";

const __dir =
  typeof __dirname !== "undefined"
    ? __dirname
    : dirname(fileURLToPath(import.meta.url));

const promptPath = resolve(__dir, "../prompts/dispatcher.md");
const dispatcherSystemPrompt = readFileSync(promptPath, "utf-8");

const checkpointer = new MemorySaver();

/**
 * Creates a fresh DeepAgent whose tools and subagents are all bound to the
 * given session. This ensures concurrent requests never share mutable state.
 */
function createDispatcherAgent(session: AgentSession) {
  const csom = createCsomTools(session);
  return createDeepAgent({
    name: "tangle-dispatcher",
    model: createProxyModel("claude-sonnet-4-6"),
    tools: [csom.getPipelineState],
    subagents: [
      createGenericAssistantSubagent(session),
      createPipelineArchitectSubagent(session),
      createPipelineRepairSubagent(session),
      createDebugAssistantSubagent(session),
      createGeneralHelpSubagent(session),
    ],
    systemPrompt: dispatcherSystemPrompt,
    middleware: [
      createLoggingMiddleware("tangle-dispatcher", session.threadId),
      createObservabilityMiddleware("tangle-dispatcher", session.emitter),
    ],
    checkpointer,
  });
}

interface InvokeParams {
  message: string;
  threadId?: string;
  selectedEntityId?: string;
  session: AgentSession;
}

interface InvokeResult {
  answer: string;
  commands: AgentSession["commands"];
  context: string;
  threadId: string;
}

export async function invokeDispatcher(
  params: InvokeParams,
): Promise<InvokeResult> {
  const { session } = params;
  const agent = createDispatcherAgent(session);

  const threadId = params.threadId ?? `thread-${Date.now()}`;

  let userContent = params.message;
  if (params.selectedEntityId) {
    userContent += `\n\n[Context: The user has entity $id="${params.selectedEntityId}" selected in the editor.]`;
  }

  const result = await agent.invoke(
    {
      messages: [{ role: "user", content: userContent }],
    },
    {
      configurable: { thread_id: threadId },
    },
  );

  const lastMessage = result.messages[result.messages.length - 1];
  const answer =
    typeof lastMessage.content === "string"
      ? lastMessage.content
      : JSON.stringify(lastMessage.content);

  writeExecutionSummary(threadId);

  return {
    answer,
    commands: session.commands,
    context: "",
    threadId,
  };
}
