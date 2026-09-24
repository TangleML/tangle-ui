/**
 * Shared Web Worker API factory for the in-browser agent.
 *
 * Both the Editor and Run View workers reuse this factory; they differ
 * only in the {@link TangleDispatcher} they are built with. The page that
 * spawns the worker bakes its {@link AgentContext} into `init()` so the
 * dispatcher (and its sub-agents) are immediately aware of where they run
 * and which run they inspect.
 */
import type { AiProviderConfig } from "@/types/aiProvider";

import type { TangleDispatcher } from "./agents/dispatcherRuntime";
import {
  type ComponentCatalog,
  createComponentCatalog,
} from "./componentCatalog";
import { ProxyClient } from "./config";
import { createSession, type RecentPipelineRun } from "./session";
import { SkillsLoader } from "./skills/loader";
import type { ToolBridgeApi } from "./toolBridgeApi";
import type { AgentContext, AgentResponse, StatusCallback } from "./types";

interface AskParams {
  message: string;
  threadId?: string;
  recentRuns?: RecentPipelineRun[];
  aiConfig: AiProviderConfig;
}

export interface AgentWorkerApi {
  init(
    bridge: ToolBridgeApi,
    onStatus: StatusCallback,
    context: AgentContext,
  ): void;
  ping(): Promise<"pong">;
  ask(params: AskParams, signal?: AbortSignal): Promise<AgentResponse>;
}

function generateThreadId(): string {
  return `thread-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createWorkerApi(
  createDispatcher: () => TangleDispatcher,
): AgentWorkerApi {
  let dispatcher: TangleDispatcher | null = null;
  let bridge: ToolBridgeApi | null = null;
  let context: AgentContext | null = null;
  let emitStatus: StatusCallback = () => {};
  const proxyClient = new ProxyClient();
  const skillsLoader = new SkillsLoader();
  // Keyed by thread so a search in one conversation is not offered to another,
  // and so an id stays usable in the turn after the one that found it.
  const componentCatalogs = new Map<string, ComponentCatalog>();

  return {
    /**
     * Initialization entry point. Called once by the main thread
     * immediately after spawning the worker.
     */
    init(toolBridge, onStatus, agentContext) {
      // Dispose any prior dispatcher (detaches its observability listeners)
      // so a fresh onStatus fully replaces the old one on re-init.
      dispatcher?.dispose();
      bridge = toolBridge;
      emitStatus = onStatus;
      context = agentContext;
      dispatcher = createDispatcher();
    },

    async ping() {
      return "pong";
    },

    async ask({ message, threadId, recentRuns, aiConfig }, _signal) {
      // todo: add logic to handle the signal

      if (!dispatcher || !bridge || !context) {
        throw new Error(
          "Agent worker not initialized. Call init() before ask().",
        );
      }
      const resolvedThreadId = threadId ?? generateThreadId();
      let componentCatalog = componentCatalogs.get(resolvedThreadId);
      if (!componentCatalog) {
        componentCatalog = createComponentCatalog();
        componentCatalogs.set(resolvedThreadId, componentCatalog);
      }
      const session = createSession({
        threadId: resolvedThreadId,
        emitStatus,
        proxyClient,
        bridge,
        skillsLoader,
        aiConfig,
        recentRuns,
        context,
        componentCatalog,
      });

      const result = await dispatcher.invoke({
        message,
        threadId: resolvedThreadId,
        aiConfig,
        session,
      });

      return {
        answer: result.answer,
        threadId: result.threadId,
        componentReferences: session.componentReferences,
      };
    },
  };
}
