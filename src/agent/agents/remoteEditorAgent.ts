/**
 * Remote editor agent for the Tangent remote sub-agent host.
 *
 * Unlike the Editor dispatcher (a router that delegates to specialists),
 * this is a flat agent: Prime spawns it with a resolved CSOM tool
 * allowlist + system prompt, and it edits the live open pipeline
 * directly. The tool surface is the same Comlink-proxied `ToolBridgeApi`
 * the Sidekick uses, so its mutations are live and undoable.
 *
 * The agent is rebuilt per turn because its tools close over the
 * per-turn `AgentSession` (bridge, recent runs, status emitter), mirroring
 * `dispatcherRuntime`.
 */
import { Agent } from "@openai/agents";

import { getAgentModelConfig } from "../config";
import { attachObservabilityHooks } from "../middleware/observability";
import remoteEditorPrompt from "../prompts/remoteEditor.md?raw";
import remoteRunPrompt from "../prompts/remoteRun.md?raw";
import type { AgentSession } from "../session";
import { createComponentSearchTools } from "../tools/componentSearchTools";
import { createCsomTools } from "../tools/csomTools";
import { createDebugTools } from "../tools/debugTools";
import { createRunTools } from "../tools/runTools";
import type { AgentContext } from "../types";

/** Resolved spawn spec the server sends via `RemoteSpawnCommand`. */
export interface RemoteAgentSpec {
  /** Tool allowlist by name. Empty means "all registered tools". */
  tools: string[];
  /** Appended system prompt (layers under the baked editor prompt). */
  systemPrompt: string;
  /** Optional model id override; falls back to the host's AI config. */
  model?: string;
}

export type RemoteEditorTool = ReturnType<
  typeof createCsomTools
>["allTools"][number];

/**
 * Full registry of tools a remote editor agent can be granted. The server
 * allowlist selects a subset.
 *
 * The registry depends on the host page mode:
 * - `editor`: the full mutating CSOM surface + `search_components` (because
 *   `add_task` is useless without a component reference to add) + the run
 *   lifecycle tools + the read-only debug tools.
 * - `runView`: a read-only inspect surface for an open pipeline run — no spec
 *   mutations, no `search_components`, and no `submit_pipeline_run`.
 */
function buildToolRegistry(session: AgentSession): RemoteEditorTool[] {
  const csom = createCsomTools(session.bridge);
  const componentSearch = createComponentSearchTools(session);
  const runTools = createRunTools(session.bridge);
  const debugTools = createDebugTools(session.bridge);

  if (session.context.mode === "runView") {
    return [
      csom.getPipelineState,
      csom.validatePipeline,
      runTools.getRunStatus,
      runTools.debugPipelineRun,
      ...debugTools.allTools,
    ];
  }

  return [
    ...csom.allTools,
    componentSearch.searchComponents,
    ...runTools.allTools,
    ...debugTools.allTools,
  ];
}

/**
 * Selects the granted tools from the registry. An empty allowlist grants
 * the full registry (so a spawn issued before the bundle template lands is
 * not tool-less); unknown names are ignored.
 */
export function selectRemoteEditorTools(
  session: AgentSession,
  toolNames: string[],
): RemoteEditorTool[] {
  const registry = buildToolRegistry(session);
  if (toolNames.length === 0) return registry;
  const allowed = new Set(toolNames);
  return registry.filter((toolDef) => allowed.has(toolDef.name));
}

function formatCurrentRunSection(context: AgentContext): string {
  if (context.mode !== "runView") return "";
  const subgraph = context.subgraphExecutionId
    ? `\n- subgraph execution: ${context.subgraphExecutionId}`
    : "";
  return `\n\n## Current run\n\nThe user is viewing run ${context.runId}. Treat this as "the current run" / "this run" unless they name a different run id.${subgraph}`;
}

function buildInstructions(
  session: AgentSession,
  spec: RemoteAgentSpec,
): string {
  const base =
    session.context.mode === "runView" ? remoteRunPrompt : remoteEditorPrompt;
  const runSection = formatCurrentRunSection(session.context);
  const appended = spec.systemPrompt.trim();
  const taskSpecific = appended
    ? `\n\n## Task-specific instructions\n\n${appended}`
    : "";
  return `${base}${runSection}${taskSpecific}`;
}

export function buildRemoteEditorAgent(
  session: AgentSession,
  spec: RemoteAgentSpec,
): Agent {
  const modelConfig = getAgentModelConfig({
    ...session.aiConfig,
    model: spec.model ?? session.aiConfig.model,
  });
  const agent = new Agent({
    name: "tangle-remote-editor",
    instructions: buildInstructions(session, spec),
    tools: selectRemoteEditorTools(session, spec.tools),
    ...modelConfig,
  });
  attachObservabilityHooks(agent, session.emitStatus);
  return agent;
}
