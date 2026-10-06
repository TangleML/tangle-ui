import type { Agent } from "@openai/agents";

import type { StatusCallback } from "../types";
import {
  type AgentTraceEvent,
  recordTraceEvent,
  truncateForTrace,
} from "./agentTrace";

const TOOL_STATUS_LABELS: Record<string, string> = {
  search_components: "Searching component registry...",
  search_docs: "Searching documentation...",
  get_pipeline_state: "Reading pipeline state...",
  add_task: "Adding task...",
  delete_task: "Removing task...",
  rename_task: "Renaming task...",
  add_input: "Adding input...",
  add_output: "Adding output...",
  delete_input: "Removing input...",
  delete_output: "Removing output...",
  connect_nodes: "Connecting nodes...",
  delete_edge: "Removing connection...",
  set_task_argument: "Configuring task...",
  create_subgraph: "Creating subgraph...",
  unpack_subgraph: "Unpacking subgraph...",
  validate_pipeline: "Validating pipeline...",
  submit_pipeline_run: "Submitting run...",
  get_run_status: "Checking run status...",
  debug_pipeline_run: "Fetching run logs...",
  get_pipeline_run: "Fetching run details...",
  get_execution_state: "Inspecting execution state...",
  get_execution_details: "Fetching execution details...",
  get_container_state: "Inspecting container state...",
  get_container_log: "Fetching container logs...",
  // Specialist sub-agents wrapped via `Agent.asTool(...)`. The dispatcher
  // fires `agent_tool_start` with these names whenever it delegates to a
  // specialist; the legacy `agent_handoff` event no longer fires because
  // the dispatcher has no handoffs anymore.
  ask_general_help: "Looking up information...",
  ask_pipeline_repair: "Asking pipeline-repair...",
  ask_pipeline_architect: "Designing pipeline...",
  ask_debug_assistant: "Analyzing run failure...",
};

// Retained for the (hypothetical) case where a sub-agent itself uses
// handoffs internally. The dispatcher no longer does — its specialists
// are exposed as asTool wrappers, see `ask_*` entries above.
const SUB_AGENT_LABELS: Record<string, string> = {
  "pipeline-architect": "Building pipeline...",
  "pipeline-repair": "Repairing pipeline...",
  "debug-assistant": "Analyzing issues...",
  "general-help": "Looking up information...",
};

interface TracedToolCall {
  key: string;
  args?: string;
}

/**
 * Read structurally because `ToolCallItem`'s members carry the call's identity
 * under different names and a provider may send a shape the union does not
 * cover. A throw here would happen inside a lifecycle hook and take the agent's
 * turn down with it.
 */
function readToolCall(toolCall: unknown): TracedToolCall {
  if (typeof toolCall !== "object" || toolCall === null) return { key: "?" };
  const record = toolCall as Record<string, unknown>;
  const key =
    [record.callId, record.id, record.name].find(
      (candidate): candidate is string => typeof candidate === "string",
    ) ?? "?";
  const args = record.arguments;
  return { key, args: typeof args === "string" ? args : undefined };
}

function trace(
  agent: string,
  kind: AgentTraceEvent["kind"],
  label: string,
  extra: { detail?: string; durationMs?: number } = {},
): void {
  recordTraceEvent({ at: Date.now(), agent, kind, label, ...extra });
}

/**
 * Wire this on EVERY agent. Specialist sub-agents run nested via
 * `Agent.asTool(...)`, and inside a nested run only that sub-agent's own hooks
 * fire — without per-agent wiring the status line freezes while a specialist
 * works. Every call also goes to {@link agentTrace}, which is the record the
 * status line cannot be, since each event overwrites the last.
 *
 * `Agent<any, any>` matches both the dispatcher, which infers handoff output
 * types, and each sub-agent on the default `TextOutput`. The hook payloads are
 * independent of those generics.
 */
export function attachObservabilityHooks(
  agent: Agent<any, any>,
  emitStatus: StatusCallback,
): () => void {
  const inFlight = new Map<string, { name: string; startedAt: number }>();

  const onStart = () => {
    emitStatus({ text: "Thinking..." });
    trace(agent.name, "turn-start", "turn start");
  };

  const onEnd = () => {
    emitStatus({ text: "Preparing response..." });
    for (const call of inFlight.values()) {
      trace(agent.name, "tool-hung", call.name, {
        detail: "never returned",
        durationMs: Date.now() - call.startedAt,
      });
    }
    inFlight.clear();
    trace(agent.name, "turn-end", "turn end");
  };

  const onToolStart = (
    _ctx: unknown,
    toolDef: { name: string },
    details?: { toolCall: unknown },
  ) => {
    emitStatus({
      text: TOOL_STATUS_LABELS[toolDef.name] ?? "Working...",
    });
    const { key, args } = readToolCall(details?.toolCall);
    inFlight.set(key, { name: toolDef.name, startedAt: Date.now() });
    trace(agent.name, "tool-start", toolDef.name, {
      detail: args ? truncateForTrace(args) : undefined,
    });
  };

  const onToolEnd = (
    _ctx: unknown,
    toolDef: { name: string },
    result: string,
    details?: { toolCall: unknown },
  ) => {
    const { key } = readToolCall(details?.toolCall);
    const started = inFlight.get(key);
    inFlight.delete(key);
    trace(agent.name, "tool-end", toolDef.name, {
      detail: result ? truncateForTrace(result) : undefined,
      durationMs: started ? Date.now() - started.startedAt : undefined,
    });
  };

  const onHandoff = (_ctx: unknown, nextAgent: { name: string }) => {
    emitStatus({
      text:
        SUB_AGENT_LABELS[nextAgent.name] ??
        `Delegating to ${nextAgent.name}...`,
    });
    trace(agent.name, "turn-start", `handoff to ${nextAgent.name}`);
  };

  agent.on("agent_start", onStart);
  agent.on("agent_end", onEnd);
  agent.on("agent_tool_start", onToolStart);
  agent.on("agent_tool_end", onToolEnd);
  agent.on("agent_handoff", onHandoff);

  return () => {
    agent.off("agent_start", onStart);
    agent.off("agent_end", onEnd);
    agent.off("agent_tool_start", onToolStart);
    agent.off("agent_tool_end", onToolEnd);
    agent.off("agent_handoff", onHandoff);
    inFlight.clear();
  };
}
