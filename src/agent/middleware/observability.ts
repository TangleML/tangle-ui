/**
 * Observability hooks for the in-browser agent.
 *
 * `@openai/agents` exposes lifecycle events on every `Agent` instance
 * via its inherited `EventEmitter`. We attach listeners that translate
 * the raw events into short status strings and forward them to the
 * main thread through the Comlink-proxied status callback.
 *
 * Wire this on EVERY agent. Specialist sub-agents are invoked as nested
 * runs via `Agent.asTool(...)`, and inside those nested runs only the
 * sub-agent's own hooks fire — without per-agent wiring the status line
 * freezes while a specialist is working.
 */
import type { Agent } from "@openai/agents";

import type { StatusCallback } from "../types";

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

// `Agent<any, any>` matches both the dispatcher (which infers handoff
// output types) and each sub-agent (default `TextOutput`). The hook
// payloads are independent of the agent's generic parameters, so the
// looser type here is intentional.
export function attachObservabilityHooks(
  agent: Agent<any, any>,
  emitStatus: StatusCallback,
): () => void {
  const onStart = () => {
    emitStatus({ text: "Thinking..." });
  };

  const onEnd = () => {
    emitStatus({ text: "Preparing response..." });
  };

  const onToolStart = (_ctx: unknown, toolDef: { name: string }) => {
    emitStatus({
      text: TOOL_STATUS_LABELS[toolDef.name] ?? "Working...",
    });
  };

  const onHandoff = (_ctx: unknown, nextAgent: { name: string }) => {
    emitStatus({
      text:
        SUB_AGENT_LABELS[nextAgent.name] ??
        `Delegating to ${nextAgent.name}...`,
    });
  };

  agent.on("agent_start", onStart);
  agent.on("agent_end", onEnd);
  agent.on("agent_tool_start", onToolStart);
  agent.on("agent_handoff", onHandoff);

  return () => {
    agent.off("agent_start", onStart);
    agent.off("agent_end", onEnd);
    agent.off("agent_tool_start", onToolStart);
    agent.off("agent_handoff", onHandoff);
  };
}
