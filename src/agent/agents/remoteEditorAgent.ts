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
import type { ThinkingLevel } from "@tangent/shared/contracts.ts";

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

export interface RemoteAgentSpec {
  tools: string[];
  systemPrompt: string;
  model?: string;
  thinkingDepth?: ThinkingLevel;
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

export function selectRemoteEditorTools(
  session: AgentSession,
  toolNames: string[],
): RemoteEditorTool[] {
  const registry = buildToolRegistry(session);
  const allowed = new Set(toolNames);
  return registry.filter((toolDef) => allowed.has(toolDef.name));
}

function formatToolAvailabilitySection(tools: RemoteEditorTool[]): string {
  const names = tools.map((toolDef) => `\`${toolDef.name}\``).join(", ");
  const available = names || "none";
  return `\n\n## Available tools\n\nYou have exactly these tools: ${available}. Do not attempt workflow steps that require a tool outside this list. If a missing tool prevents the requested work, state that limitation clearly.`;
}

function reasoningEffort(
  thinkingDepth: ThinkingLevel | undefined,
): Exclude<ThinkingLevel, "off"> | "none" | undefined {
  if (!thinkingDepth) return undefined;
  return thinkingDepth === "off" ? "none" : thinkingDepth;
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
  tools: RemoteEditorTool[],
): string {
  const base =
    session.context.mode === "runView" ? remoteRunPrompt : remoteEditorPrompt;
  const runSection = formatCurrentRunSection(session.context);
  const toolSection = formatToolAvailabilitySection(tools);
  const appended = spec.systemPrompt.trim();
  const taskSpecific = appended
    ? `\n\n## Task-specific instructions\n\n${appended}`
    : "";
  return `${base}${runSection}${taskSpecific}${toolSection}`;
}

export function buildRemoteEditorAgent(
  session: AgentSession,
  spec: RemoteAgentSpec,
): Agent {
  const modelConfig = getAgentModelConfig({
    ...session.aiConfig,
    model: spec.model ?? session.aiConfig.model,
  });
  const tools = selectRemoteEditorTools(session, spec.tools);
  const effort = reasoningEffort(spec.thinkingDepth);
  const agent = new Agent({
    name: "tangle-remote-editor",
    instructions: buildInstructions(session, spec, tools),
    tools,
    ...modelConfig,
    modelSettings: {
      ...modelConfig.modelSettings,
      ...(effort ? { reasoning: { effort } } : {}),
    },
  });
  attachObservabilityHooks(agent, session.emitStatus);
  return agent;
}
