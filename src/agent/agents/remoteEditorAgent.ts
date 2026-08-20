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
import type { AgentSession } from "../session";
import { createComponentSearchTools } from "../tools/componentSearchTools";
import { createCsomTools } from "../tools/csomTools";
import { createRunTools } from "../tools/runTools";

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
 * allowlist selects a subset; `search_components` is included because
 * `add_task` is useless without a component reference to add.
 */
function buildToolRegistry(session: AgentSession): RemoteEditorTool[] {
  const csom = createCsomTools(session.bridge);
  const componentSearch = createComponentSearchTools(session);
  const runTools = createRunTools(session.bridge);
  return [
    ...csom.allTools,
    componentSearch.searchComponents,
    ...runTools.allTools,
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

function buildInstructions(spec: RemoteAgentSpec): string {
  const appended = spec.systemPrompt.trim();
  if (!appended) return remoteEditorPrompt;
  return `${remoteEditorPrompt}\n\n## Task-specific instructions\n\n${appended}`;
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
    instructions: buildInstructions(spec),
    tools: selectRemoteEditorTools(session, spec.tools),
    ...modelConfig,
  });
  attachObservabilityHooks(agent, session.emitStatus);
  return agent;
}
