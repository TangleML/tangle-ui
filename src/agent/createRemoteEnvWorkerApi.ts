/**
 * Web Worker API for the Tangent remote sub-agent host.
 *
 * Where {@link createWorkerApi} backs a single-thread Sidekick chat, this
 * factory hosts several remote sub-agents at once — one entry per Tangent
 * `agentId` — because Prime can spawn more than one editor agent in a
 * session. Each agent keeps its own `MemorySession` so its conversation
 * history is isolated; the agent itself is rebuilt per turn (its tools
 * close over the per-turn `AgentSession`), mirroring `dispatcherRuntime`.
 *
 * The socket transport and token lifecycle live on the main thread (see
 * `remoteEnvHost.ts`); this worker only owns the expensive `run()` loop
 * and the CSOM tool surface bound to the live spec via the Comlink bridge.
 * Status is reported per turn (not via a worker-global callback) so the
 * host can attribute each update to the message's Run.
 */
import { MemorySession, run } from "@openai/agents";

import type { AiProviderConfig } from "@/types/aiProvider";

import {
  buildRemoteEditorAgent,
  type RemoteAgentSpec,
} from "./agents/remoteEditorAgent";
import { ProxyClient } from "./config";
import { createSession, type RecentPipelineRun } from "./session";
import { SkillsLoader } from "./skills/loader";
import type { ToolBridgeApi } from "./toolBridgeApi";
import type { AgentContext, StatusCallback } from "./types";

interface RemoteSpawnAgentParams {
  agentId: string;
  tools: string[];
  systemPrompt: string;
  model?: string;
}

interface RemoteRunTurnParams {
  agentId: string;
  message: string;
  recentRuns?: RecentPipelineRun[];
}

interface RemoteRunTurnResult {
  answer: string;
}

export interface RemoteEnvWorkerApi {
  init(bridge: ToolBridgeApi, context: AgentContext): void;
  setAiConfig(aiConfig: AiProviderConfig): void;
  ping(): Promise<"pong">;
  spawnAgent(params: RemoteSpawnAgentParams): void;
  runTurn(
    params: RemoteRunTurnParams,
    onStatus: StatusCallback,
  ): Promise<RemoteRunTurnResult>;
  /** Aborts the agent's in-flight turn, if any, without removing it. */
  abortAgent(agentId: string): void;
  killAgent(agentId: string): void;
}

interface HostedAgent {
  spec: RemoteAgentSpec;
  memory: MemorySession;
}

export function createRemoteEnvWorkerApi(): RemoteEnvWorkerApi {
  const agents = new Map<string, HostedAgent>();
  // Owned here (not proxied from the main thread): a Comlink-proxied
  // AbortSignal reads `.aborted` as a truthy Promise, which the OpenAI SDK
  // treats as an immediate user abort. Turns are serialized per agent, so one
  // controller per agentId is enough.
  const abortControllers = new Map<string, AbortController>();
  const proxyClient = new ProxyClient();
  const skillsLoader = new SkillsLoader();

  let bridge: ToolBridgeApi | null = null;
  let context: AgentContext | null = null;
  let aiConfig: AiProviderConfig | null = null;

  return {
    init(toolBridge, agentContext) {
      bridge = toolBridge;
      context = agentContext;
    },

    setAiConfig(config) {
      aiConfig = config;
    },

    async ping() {
      return "pong";
    },

    spawnAgent({ agentId, tools, systemPrompt, model }) {
      agents.set(agentId, {
        spec: { tools, systemPrompt, ...(model ? { model } : {}) },
        memory: new MemorySession({ sessionId: agentId }),
      });
    },

    async runTurn({ agentId, message, recentRuns }, onStatus) {
      const hosted = agents.get(agentId);
      if (!hosted) {
        throw new Error(
          `Remote sub-agent "${agentId}" was not spawned before receiving a message.`,
        );
      }
      if (!bridge || !context) {
        throw new Error(
          "Remote env worker not initialized. Call init() before runTurn().",
        );
      }
      if (!aiConfig) {
        throw new Error(
          "AI assistant is not configured. Set it in Settings -> AI Configuration before using Tangent editor control.",
        );
      }

      proxyClient.ensureConfigured(aiConfig);
      const session = createSession({
        threadId: agentId,
        emitStatus: onStatus,
        proxyClient,
        bridge,
        skillsLoader,
        aiConfig,
        recentRuns,
        context,
      });

      const controller = new AbortController();
      abortControllers.set(agentId, controller);
      try {
        const agent = buildRemoteEditorAgent(session, hosted.spec);
        const result = await run(agent, message, {
          session: hosted.memory,
          signal: controller.signal,
        });

        const answer =
          typeof result.finalOutput === "string"
            ? result.finalOutput
            : JSON.stringify(result.finalOutput ?? "");
        return { answer };
      } finally {
        abortControllers.delete(agentId);
      }
    },

    abortAgent(agentId) {
      abortControllers.get(agentId)?.abort();
    },

    killAgent(agentId) {
      abortControllers.get(agentId)?.abort();
      abortControllers.delete(agentId);
      agents.delete(agentId);
    },
  };
}
