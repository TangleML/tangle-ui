import type { EventEmitter } from "events";
import { createMiddleware } from "langchain";

import { config } from "../config";

const CYAN = "\x1b[36m";
const YELLOW = "\x1b[33m";
const GREEN = "\x1b[32m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

const TOOL_STATUS_LABELS: Record<string, string> = {
  searchComponents: "Searching component registry...",
  searchDocs: "Searching documentation...",
  getPipelineState: "Reading pipeline state...",
  addTask: "Adding task...",
  deleteTask: "Removing task...",
  renameTask: "Renaming task...",
  addInput: "Adding input...",
  addOutput: "Adding output...",
  deleteInput: "Removing input...",
  deleteOutput: "Removing output...",
  connectNodes: "Connecting nodes...",
  deleteEdge: "Removing connection...",
  setTaskArgument: "Configuring task...",
  createSubgraph: "Creating subgraph...",
  unpackSubgraph: "Unpacking subgraph...",
  createPythonComponent: "Creating component...",
  runPipeline: "Running pipeline...",
  getPipelineRuns: "Checking pipeline runs...",
  getRunLogs: "Fetching run logs...",
};

const SUB_AGENT_LABELS: Record<string, string> = {
  "pipeline-architect": "Building pipeline...",
  "pipeline-repair": "Repairing pipeline...",
  "debug-assistant": "Analyzing issues...",
  "general-help": "Looking up information...",
  "generic-assistant": "Working on it...",
};

function formatMs(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function truncate(str: string, max = 120): string {
  if (str.length <= max) return str;
  return str.slice(0, max) + "...";
}

function log(agent: string, color: string, message: string) {
  if (!config.verbose) return;
  console.log(`${CYAN}[${agent}]${RESET} ${color}${message}${RESET}`);
}

/**
 * Creates observability middleware that emits status events to the given
 * emitter (scoped per-request) instead of a global singleton.
 */
export function createObservabilityMiddleware(
  agentName: string,
  statusEmitter?: EventEmitter | null,
) {
  let agentStartTime = 0;

  function emitStatus(text: string): void {
    statusEmitter?.emit("status", { text });
  }

  return createMiddleware({
    name: "ObservabilityMiddleware",

    beforeAgent: async (_state, runtime) => {
      agentStartTime = Date.now();
      const threadId = runtime?.configurable?.thread_id ?? "unknown";
      log(agentName, "", `Agent started ${DIM}(thread: ${threadId})${RESET}`);
      emitStatus("Thinking...");
    },

    afterAgent: async () => {
      const elapsed = Date.now() - agentStartTime;
      log(agentName, "", `Agent finished ${DIM}(${formatMs(elapsed)})${RESET}`);
      emitStatus("Preparing response...");
    },

    wrapModelCall: async (request, handler) => {
      const modelName =
        ("model" in request.model &&
          typeof request.model.model === "string" &&
          request.model.model) ||
        "unknown";
      const msgCount = request.messages.length;
      const toolCount = request.tools?.length ?? 0;

      log(
        agentName,
        YELLOW,
        `Calling model: ${modelName} ${DIM}(${msgCount} messages, ${toolCount} tools)${RESET}`,
      );

      const start = Date.now();
      const result = await handler(request);
      const elapsed = Date.now() - start;

      log(
        agentName,
        YELLOW,
        `Model responded ${DIM}(${formatMs(elapsed)})${RESET}`,
      );

      return result;
    },

    wrapToolCall: async (request, handler) => {
      const toolName = request.toolCall.name;
      const args = JSON.stringify(request.toolCall.args ?? {});

      if (toolName === "task") {
        const taskArgs = request.toolCall.args as Record<string, unknown>;
        const subagentType =
          (taskArgs?.subagent_type as string) ?? "general-purpose";
        log(
          agentName,
          GREEN,
          `Delegating to sub-agent: ${subagentType} ${DIM}— "${truncate(String(taskArgs?.description ?? ""))}"${RESET}`,
        );
        emitStatus(
          SUB_AGENT_LABELS[subagentType] ?? `Delegating to ${subagentType}...`,
        );
      } else {
        log(agentName, GREEN, `Tool: ${toolName}(${truncate(args, 80)})`);
        emitStatus(TOOL_STATUS_LABELS[toolName] ?? "Working...");
      }

      const start = Date.now();
      const result = await handler(request);
      const elapsed = Date.now() - start;

      if (toolName === "task") {
        log(
          agentName,
          GREEN,
          `Sub-agent returned ${DIM}(${formatMs(elapsed)})${RESET}`,
        );
      } else {
        log(
          agentName,
          GREEN,
          `Tool: ${toolName} completed ${DIM}(${formatMs(elapsed)})${RESET}`,
        );
      }

      return result;
    },
  });
}
