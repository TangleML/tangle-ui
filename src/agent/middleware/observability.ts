/**
 * Observability hooks for the in-browser agent.
 *
 * OpenAI Agents exposes lifecycle events on every `Agent` instance via
 * its inherited `EventEmitter`. We attach listeners that translate the
 * raw events into the same status strings the deepagents/LangChain
 * middleware emitted previously, then forward them to the main thread
 * through the Comlink-proxied status callback.
 *
 * Wire this on every agent (dispatcher AND each sub-agent) so the status
 * line keeps updating after a handoff — once an agent is active, only
 * ITS hooks fire, not the dispatcher's.
 */
import type { Agent } from "@openai/agents";

import type { StatusCallback } from "../session";

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
};

const SUB_AGENT_LABELS: Record<string, string> = {
  "pipeline-architect": "Building pipeline...",
  "pipeline-repair": "Repairing pipeline...",
  "debug-assistant": "Analyzing issues...",
  "general-help": "Looking up information...",
  "generic-assistant": "Working on it...",
};

// `Agent<any, any>` matches both the dispatcher (which has handoff output
// inference) and each sub-agent (default `TextOutput`). The hook payloads
// are independent of the agent's generic parameters.
export function attachObservabilityHooks(
  agent: Agent<any, any>,
  emitStatus: StatusCallback,
): void {
  agent.on("agent_start", () => {
    emitStatus({ text: "Thinking..." });
  });

  agent.on("agent_end", () => {
    emitStatus({ text: "Preparing response..." });
  });

  agent.on("agent_tool_start", (_ctx, toolDef) => {
    emitStatus({
      text: TOOL_STATUS_LABELS[toolDef.name] ?? "Working...",
    });
  });

  agent.on("agent_handoff", (_ctx, nextAgent) => {
    emitStatus({
      text:
        SUB_AGENT_LABELS[nextAgent.name] ??
        `Delegating to ${nextAgent.name}...`,
    });
  });
}
